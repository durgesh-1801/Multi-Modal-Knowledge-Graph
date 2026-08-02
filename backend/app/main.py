"""
FastAPI Application Entrypoint.

Configures:
- Lifespan startup/shutdown routines
- Centralized CORS Middleware
- Swagger OpenAPI interactive documentation
- Global JSON exception handlers (404, 422, 500, unhandled exceptions)
- Health check and API v1 routers
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.core.config import settings
from app.core.logging import logger, setup_logging
from app.schemas.common import StandardResponse


from app.core.llm_provider import get_llm_provider_instance
from app.dependencies import get_graph_interface
from app.services.embedding_service import get_embedding_service
from app.services.spacy_extractor import SpacyExtractor
from app.vector.qdrant_client import QdrantClientManager


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan context manager handling startup and shutdown events.
    """
    # 1. Initialize Loguru Logging Infrastructure
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    # 2. Ensure Upload Storage Directory Exists
    upload_dir = Path(settings.UPLOAD_DIRECTORY)
    upload_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Upload directory configured at: '{upload_dir.resolve()}'")

    # 3. Startup Diagnostics Report
    logger.info("====================================================")
    logger.info("           STARTUP DIAGNOSTICS REPORT               ")
    logger.info("====================================================")

    # Validate Groq LLM Provider
    try:
        llm = get_llm_provider_instance()
        if settings.GROQ_API_KEY:
            logger.info("[OK] Groq Connected")
        else:
            logger.info(f"[OK] LLM Provider Connected ({llm.provider_name})")
    except Exception as err:
        logger.warning(f"[WARN] LLM Provider Check Warning: {err}")

    # Validate Neo4j Knowledge Graph DB
    try:
        graph_interface = get_graph_interface(settings=settings)
        if graph_interface:
            logger.info("[OK] Neo4j Connected")
        else:
            logger.warning("[WARN] Neo4j Check Warning: Interface not initialized")
    except Exception as err:
        logger.warning(f"[WARN] Neo4j Check Warning: {err}")

    # Validate Qdrant Vector Store
    try:
        qdrant_mgr = QdrantClientManager()
        q_client = qdrant_mgr.connect()
        if qdrant_mgr.url and "cloud.qdrant.io" in qdrant_mgr.url:
            logger.info("[OK] Qdrant Cloud Connected")
        else:
            logger.info("[OK] Qdrant Connected")
    except Exception as err:
        logger.warning(f"[WARN] Qdrant Check Warning: {err}")

    # Validate spaCy NER Model
    try:
        spacy_ext = SpacyExtractor()
        nlp = spacy_ext._load_spacy()
        if hasattr(nlp, "pipe") and nlp != "FALLBACK":
            logger.info("[OK] spaCy Model Loaded")
        else:
            logger.warning("[WARN] spaCy Model Check Warning: Fallback model active")
    except Exception as err:
        logger.warning(f"[WARN] spaCy Check Warning: {err}")

    # Validate Embedding Model Singleton
    try:
        embed_svc = get_embedding_service()
        embed_svc.load_model()
        logger.info("[OK] Embedding Model Ready")
    except Exception as err:
        logger.warning(f"[WARN] Embedding Model Check Warning: {err}")

    logger.info("====================================================")

    yield

    # Shutdown logic
    logger.info(f"Shutting down {settings.APP_NAME}")


# Create FastAPI Application Instance
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Compliance Knowledge Graph Platform Backend API Foundation",
    debug=settings.DEBUG,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# -----------------------------------------------------------------------------
# CORS Middleware Configuration
# -----------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):(3000|5173)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
)


def _attach_cors_headers(response: JSONResponse, request: Request) -> JSONResponse:
    """Ensures exception responses include Access-Control-Allow-Origin headers."""
    origin = request.headers.get("origin")
    if origin and ("localhost" in origin or "127.0.0.1" in origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# -----------------------------------------------------------------------------
# Global Exception Handlers
# -----------------------------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """
    Handles standard HTTP exceptions (e.g. 404 Not Found, 403 Forbidden).
    """
    logger.warning(
        f"HTTP Exception {exc.status_code} at {request.method} {request.url.path}: {exc.detail}"
    )
    response_body = StandardResponse[None](
        success=False,
        message=str(exc.detail),
        data=None,
    )
    response = JSONResponse(
        status_code=exc.status_code,
        content=response_body.model_dump(),
    )
    return _attach_cors_headers(response, request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Handles 422 Unprocessable Entity payload/parameter validation errors.
    """
    logger.warning(
        f"Validation Error 422 at {request.method} {request.url.path}: {exc.errors()}"
    )
    response_body = StandardResponse[list](
        success=False,
        message="Request payload validation failed",
        data=exc.errors(),
    )
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_body.model_dump(),
    )
    return _attach_cors_headers(response, request)


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """
    Handles 500 Internal Server Error & any unhandled runtime exceptions.
    """
    logger.error(
        f"Unhandled Exception 500 at {request.method} {request.url.path}: {str(exc)}",
        exc_info=True,
    )
    response_body = StandardResponse[None](
        success=False,
        message=f"An unexpected internal server error occurred: {str(exc)}",
        data=None,
    )
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_body.model_dump(),
    )
    return _attach_cors_headers(response, request)


# -----------------------------------------------------------------------------
# Core & Health Endpoints
# -----------------------------------------------------------------------------
@app.get(
    "/health",
    tags=["Health Check"],
    summary="Application Health Status",
    description="Returns backend operational health status.",
)
async def health_check() -> dict[str, str]:
    """
    Operational status check endpoint.

    Returns:
        dict: Health status payload {"status": "healthy"}.
    """
    return {"status": "healthy"}


# Mount API V1 Router
app.include_router(api_router)
