"""
Common & Generic API Schema Definitions.

Provides a unified envelope format for all success and error HTTP JSON responses
produced across the application.
"""

from typing import Generic, Optional, TypeVar
from pydantic import BaseModel, Field

# Generic Type parameter for response payload payload
DataType = TypeVar("DataType")


class StandardResponse(BaseModel, Generic[DataType]):
    """
    Standardized API JSON Response Envelope.

    Attributes:
        success: Boolean flag indicating operation success (True) or failure (False).
        message: Human-readable explanatory response message.
        data: Optional payload returned by the endpoint (dict, object, list, or null).
    """

    success: bool = Field(
        default=True,
        description="Indicates whether the request was successfully processed.",
    )
    message: str = Field(
        default="Operation completed successfully",
        description="Detailed description or message regarding request execution status.",
    )
    data: Optional[DataType] = Field(
        default=None,
        description="Response payload data, null if no content is returned.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "message": "Operation completed successfully",
                "data": None,
            }
        }
    }
