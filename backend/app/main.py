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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits local frontend connectivity during development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return JSONResponse(
        status_code=exc.status_code,
        content=response_body.model_dump(),
    )


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
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_body.model_dump(),
    )


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
        message="An unexpected internal server error occurred.",
        data=None,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_body.model_dump(),
    )


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
