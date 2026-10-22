"""Run the Python validation suite and enforce core-engine line coverage."""

from __future__ import annotations

import json
import sys
import trace
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine"
COVERAGE_THRESHOLD = 80.0
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def coverage_percent(covered: int, executable: int) -> float:
    """Return a stable percentage, treating an empty file as fully covered."""
    if executable == 0:
        return 100.0
    return covered * 100.0 / executable


def meets_threshold(percent: float, threshold: float = COVERAGE_THRESHOLD) -> bool:
    return percent + 1e-9 >= threshold


def run_validation() -> int:
    # Import inside the traced call so module initialization is included.
    import validate

    return validate.main()


def collect_report(results: trace.CoverageResults) -> dict[str, object]:
    counts_by_file: dict[Path, set[int]] = {}
    for (filename, line_number), count in results.counts.items():
        if count:
            resolved = Path(filename).resolve()
            counts_by_file.setdefault(resolved, set()).add(line_number)

    files: list[dict[str, object]] = []
    total_covered = 0
    total_executable = 0
    for source in sorted(ENGINE.glob("*.py")):
        executable_lines = set(trace._find_executable_linenos(str(source)))
        if not executable_lines:
            continue
        covered_lines = executable_lines & counts_by_file.get(source.resolve(), set())
        covered = len(covered_lines)
        executable = len(executable_lines)
        total_covered += covered
        total_executable += executable
        files.append(
            {
                "path": source.relative_to(ROOT).as_posix(),
                "covered_lines": covered,
                "executable_lines": executable,
                "percent": round(coverage_percent(covered, executable), 2),
            }
        )

    percent = coverage_percent(total_covered, total_executable)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope": "engine/*.py",
        "threshold_percent": COVERAGE_THRESHOLD,
        "covered_lines": total_covered,
        "executable_lines": total_executable,
        "percent": round(percent, 2),
        "passed": meets_threshold(percent),
        "files": files,
    }


def main() -> int:
    runner = trace.Trace(count=True, trace=False, ignoredirs=[sys.prefix, sys.base_prefix])
    validation_status = runner.runfunc(run_validation)
    report = collect_report(runner.results())
    report["validation_exit_code"] = validation_status

    evidence = ROOT / "docs/evidence/python_coverage.json"
    evidence.parent.mkdir(parents=True, exist_ok=True)
    evidence.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(
        "Python engine coverage: "
        f"{report['percent']:.2f}% "
        f"({report['covered_lines']}/{report['executable_lines']} lines; "
        f"required {COVERAGE_THRESHOLD:.2f}%)"
    )
    if validation_status != 0:
        print(f"Python validation failed with exit code {validation_status}.", file=sys.stderr)
        return validation_status
    if not report["passed"]:
        print("Python engine coverage is below the required threshold.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
