"""
Logging Architecture Module.

Provides a unified loguru-based logging system featuring:
- Formatted console output with dynamic colorization
- General application log file with automatic rotation and retention
- Dedicated error log file capturing ERROR & CRITICAL events
- Uvicorn / Standard Python logging interception for seamless log formatting
"""

import sys
import logging
from pathlib import Path
from loguru import logger

from app.core.config import settings


class InterceptHandler(logging.Handler):
    """
    Custom logging handler that intercepts standard library Python log calls
    (including Uvicorn & FastAPI internal logs) and routes them through Loguru.
    """

    def emit(self, record: logging.LogRecord) -> None:
        # Get corresponding Loguru level if it exists
        try:
            level: str | int = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Find caller from where originated the logged message
        frame = sys._getframe(6)
        depth = 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging() -> None:
    """
    Initializes and configures Loguru logger for console, file rotation, and error logging.
    Hooks into standard Python logging to unify log output across dependencies.
    """
    # Ensure logs directory exists
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)

    # Remove all default loguru handlers
    logger.remove()

    # 1. Console Logging Handler
    console_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
        "<level>{message}</level>"
    )
    logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL.upper(),
        format=console_format,
        colorize=True,
    )

    # 2. General Application File Logging (Rotating)
    app_log_path = log_dir / "app.log"
    logger.add(
        str(app_log_path),
        level=settings.LOG_LEVEL.upper(),
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation="10 MB",
        retention="10 days",
        compression="zip",
        enqueue=True,
    )

    # 3. Dedicated Error File Logging (Rotating)
    error_log_path = log_dir / "error.log"
    logger.add(
        str(error_log_path),
        level="ERROR",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}",
        rotation="5 MB",
        retention="30 days",
        compression="zip",
        enqueue=True,
        backtrace=True,
        diagnose=settings.DEBUG,
    )

    # Intercept Uvicorn and FastAPI standard loggers
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        mod_logger = logging.getLogger(logger_name)
        mod_logger.handlers = [InterceptHandler()]
        mod_logger.propagate = False

    logger.info("Logging infrastructure successfully initialized.")


# Export configured logger for application-wide imports
__all__ = ["setup_logging", "logger"]
