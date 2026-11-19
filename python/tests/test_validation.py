import pytest
from churniq.pipeline import run_pipeline
from churniq.loading import load
from churniq.validation import DatasetError


@pytest.mark.parametrize(
    "source",
    [b"", b"garbage", b"foo,bar\n1,2", b"customerID,tenure,MonthlyCharges,Contract,Churn\na,1,2,One year,No"],
)
def test_invalid(source):
    with pytest.raises(DatasetError):
        run_pipeline(source)


def test_small_rule_based(dataset_path):
    raw, _ = load(dataset_path)
    r = run_pipeline(raw.head(100).to_csv(index=False))
    assert r["risk"]["method"] == "rule_based"
    assert r["modelPerformance"]["models"] == []
