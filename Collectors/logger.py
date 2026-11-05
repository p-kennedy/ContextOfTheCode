from __future__ import annotations

import logging

# ANSI colour codes
_GREEN = "\033[32m"
_YELLOW = "\033[33m"
_RED = "\033[31m"
_RESET = "\033[0m"
_BOLD = "\033[1m"

_LEVEL_COLOURS = {
    logging.DEBUG: "",
    logging.INFO: _GREEN,
    logging.WARNING: _YELLOW,
    logging.ERROR: _RED,
    logging.CRITICAL: _BOLD + _RED,
}


class ColouredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        colour = _LEVEL_COLOURS.get(record.levelno, "")
        record.levelname = f"{colour}{record.levelname}{_RESET}"
        record.msg = f"{colour}{record.msg}{_RESET}"
        return super().format(record)


def get_logger(name: str) -> logging.Logger:
    """Return a logger with coloured output. Safe to call multiple times."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    handler = logging.StreamHandler()
    handler.setFormatter(
        ColouredFormatter(fmt="%(asctime)s %(levelname)s %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger
