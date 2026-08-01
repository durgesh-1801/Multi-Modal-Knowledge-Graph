# Enterprise Compliance Knowledge Graph Platform - Backend Foundation

An enterprise-grade, asynchronous backend foundation built with **FastAPI**, **Pydantic v2**, and **Loguru** for an AI-powered Enterprise Compliance Knowledge Graph platform.

---

## 🛠️ Technology Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- **ASGI Server**: [Uvicorn](https://www.uvicorn.org/)
- **Data Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) & `pydantic-settings`
- **Logging**: [Loguru](https://github.com/Delgan/loguru) (Console, Rotating file log, Error log)
- **HTTP Client**: [HTTPX](https://www.python-httpx.org/)
- **Async Processing**: Python `asyncio`

---

## 📁 Project Architecture

```text
backend/
│
├── app/
│   ├── api/                # API Routers & Endpoint Handlers
│   │   ├── __init__.py     # Aggregated V1 API Router
│   │   ├── upload.py       # PDF & Audio ingestion endpoints
│   │   └── chat.py         # Compliance query/chat endpoints
│   │
│   ├── core/               # Application Core Infrastructure
│   │   ├── config.py       # Pydantic BaseSettings management
│   │   └── logging.py      # Loguru setup with log rotation & Uvicorn interception
│   │
│   ├── services/           # [Marker] Business logic & domain services
│   ├── rag/                # [Marker] Retrieval-Augmented Generation (LangGraph)
│   ├── vector/             # [Marker] Qdrant vector database abstractions
│   ├── utils/              # [Marker] Shared helper functions
│   ├── schemas/            # Request/Response Pydantic schemas
│   │   ├── common.py       # Generic StandardResponse[T] envelope
│   │   ├── upload.py       # Upload models
│   │   └── chat.py         # Chat request & response models
│   │
│   ├── dependencies.py     # FastAPI dependency injection providers
│   └── main.py             # FastAPI app initialization, middleware & exception handlers
│
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── requirements.txt        # Python backend dependencies
└── README.md               # Project documentation
```

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` before running the backend:

```bash
cp .env.example .env
```

### Configuration Variables (`app/core/config.py`)

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `APP_NAME` | `Enterprise Compliance Knowledge Graph` | Application title |
| `APP_VERSION` | `0.1.0` | Semantic versioning string |
| `DEBUG` | `true` | Enables FastAPI debug mode |
| `GROQ_API_KEY` | *(None)* | Secret API key for Groq AI integration |
| `LLM_PROVIDER` | `groq` | Active LLM Provider engine adapter |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Target Groq model identifier |
| `QDRANT_URL` | `http://localhost:6333` | Host URL for Qdrant Vector Store |
| `QDRANT_API_KEY` | *(None)* | Optional cloud API key for Qdrant |
| `NEO4J_URI` | `bolt://localhost:7687` | Connection URI for Neo4j Knowledge Graph |
| `NEO4J_USERNAME` | `neo4j` | Database username for Neo4j |
| `NEO4J_PASSWORD` | `password` | Database password for Neo4j |
| `UPLOAD_DIRECTORY` | `uploads` | Local folder path for file storage |
| `MAX_UPLOAD_SIZE` | `104857600` | Max file upload limit in bytes (100MB) |
| `LOG_LEVEL` | `INFO` | Logging threshold (`DEBUG`, `INFO`, `ERROR`) |

---

## 🚀 Quick Start Guide

### 1. Create and Activate Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate on Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Activate on Linux/macOS
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Run Development Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📌 API Endpoint Reference

### Health Check

- **`GET /health`**
  - **Response**: `{"status": "healthy"}`

### Document & Audio Ingestion (`/api/v1/upload`)

- **`POST /api/v1/upload/pdf`**
  - **Description**: Upload compliance PDF file (Placeholder)
  - **Response**: Standard JSON response with `message: "Not implemented"`
- **`POST /api/v1/upload/audio`**
  - **Description**: Upload audio recording file (Placeholder)
  - **Response**: Standard JSON response with `message: "Not implemented"`

### Compliance Chat (`/api/v1/chat`)

- **`POST /api/v1/chat`**
  - **Description**: Submit natural language compliance question (Placeholder)
  - **Response**: Standard JSON response with `message: "Not implemented"`

---

## 📖 API Documentation & Swagger

When the application is running, interact with the automatically generated API documentation:

- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **OpenAPI Schema**: [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json)

---

## 📊 Error Handling & Envelope Specification

All non-health endpoints return responses structured using the generic `StandardResponse` model:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Errors (`404`, `422`, `500`) automatically format into this same schema:

```json
{
  "success": false,
  "message": "Request payload validation failed",
  "data": [
    {
      "type": "missing",
      "loc": ["body", "message"],
      "msg": "Field required"
    }
  ]
}
```
