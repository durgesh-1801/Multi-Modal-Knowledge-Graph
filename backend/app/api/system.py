"""
System Diagnostics and Health Check API Router.

Provides health checks for system components including active LLM Provider status.
"""

from typing import Any, Dict
from fastapi import APIRouter, Depends, status

from app.core.llm_provider import BaseLLMProvider
from app.dependencies import get_llm_provider
from app.schemas.common import StandardResponse

router = APIRouter()


@router.get(
    "/llm",
    response_model=StandardResponse[Dict[str, Any]],
    status_code=status.HTTP_200_OK,
    summary="Get Active LLM Provider Health Status",
    description="Returns connectivity status, latency, provider name, and active model for the active LLM engine.",
)
async def get_llm_health(
    llm_provider: BaseLLMProvider = Depends(get_llm_provider),
) -> StandardResponse[Dict[str, Any]]:
    """
    Returns diagnostic health check for active LLM provider.
    """
    health_data = await llm_provider.health_check()
    return StandardResponse[Dict[str, Any]](
        success=True,
        message="LLM Provider health check completed",
        data=health_data,
    )
