"""Command-line JSON reporting."""

import argparse
import json
from pathlib import Path
from .pipeline import run_pipeline
from .validation import DatasetError


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m churniq")
    commands = parser.add_subparsers(dest="command", required=True)
    report = commands.add_parser("report")
    report.add_argument("--csv", type=Path)
    report.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = run_pipeline(args.csv)
        args.out.write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    except DatasetError as exc:
        parser.exit(2, f"Dataset error: {exc}\n")
    print(f'Wrote {args.out}: {result["kpis"]["totalCustomers"]:,} customers')


if __name__ == "__main__":
    main()
