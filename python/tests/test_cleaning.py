import csv
from churniq.loading import load
from churniq.cleaning import clean


def test_real_cleaning(result, dataset_path):
    r = result["report"]
    assert (r["finalRecords"], r["rawAttributes"]) == (7043, 21)
    raw, name = load(dataset_path)
    d, _ = clean(raw, name)
    ids = raw.loc[raw.TotalCharges.str.strip().eq(""), "customerID"]
    assert len(ids) == 11
    assert (d.loc[d.id.isin(ids), "tenure"] == 0).all()
    assert (d.loc[d.id.isin(ids), "totalCharges"] == 0).all()
    assert r["imputedZero"] == 11
    with open(dataset_path, newline="") as f:
        independent = sum(row["Churn"] == "Yes" for row in csv.DictReader(f))
    k = result["kpis"]
    assert independent == k["churnedCustomers"] == 1869
    assert k["churnedCustomers"] + k["activeCustomers"] == k["totalCustomers"]
