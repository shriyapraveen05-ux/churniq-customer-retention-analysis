import os
from churniq.loading import default_path
import pytest
from churniq.pipeline import run_pipeline


@pytest.fixture(scope="session")
def dataset_path():
    return str(default_path())


@pytest.fixture(scope="session")
def result(dataset_path):
    return run_pipeline(dataset_path)
