"""
Logging Architecture Module.

Provides unified logging with fallback support for standard Python logging or Loguru.
"""

import sys
import logging
from pathlib import Path

try:
    from loguru import logger
    HAS_LOGURU = True
except ImportError:
    HAS_LOGURU = False
    logger = logging.getLogger("app")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("[%(levelname)s] %(asctime)s - %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

from app.core.config import settings


def setup_logging() -> None:
    """
    Initializes logger configuration.
    """
    if HAS_LOGURU:
        log_dir = Path("logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        logger.remove()
        logger.add(sys.stdout, level="INFO")
        logger.add(log_dir / "app.log", rotation="10 MB", retention="7 days", level="INFO")
        logger.add(log_dir / "errors.log", rotation="10 MB", retention="30 days", level="ERROR")
    else:
        logger.info("Standard logging initialized.")
