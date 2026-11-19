"""Offline reproducible CHURNIQ analytics and sklearn comparison."""

from .pipeline import run_pipeline
from .validation import DatasetError

__all__ = ["run_pipeline", "DatasetError"]
