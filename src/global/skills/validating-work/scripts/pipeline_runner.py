#!/usr/bin/env python3
"""
pipeline_runner.py — standard validation pipeline runner (plan 18).

Reads .agents/pipeline.yaml at a repo's root and runs the standard stages in
fixed order: lint -> gitleaks -> trivy -> build -> test. lint/build/test are
declared in the manifest; gitleaks/trivy are runner-owned and always run.
See ACCEPTANCE.md (plan 18) for the full spec.
"""

import subprocess
import sys
from pathlib import Path

import yaml

MANIFEST_RELATIVE_PATH = ".agents/pipeline.yaml"
CONFIGURABLE_STAGES = ("lint", "build", "test")
STAGE_ORDER = ("lint", "gitleaks", "trivy", "build", "test")


class ManifestError(Exception):
    """Raised when .agents/pipeline.yaml is malformed. Message is user-facing."""


def load_manifest(repo_root: Path) -> dict:
    """Parse and validate .agents/pipeline.yaml. Raises ManifestError on any
    malformed case, before any stage runs."""
    manifest_path = repo_root / MANIFEST_RELATIVE_PATH
    if not manifest_path.is_file():
        raise ManifestError(f"manifest not found: {MANIFEST_RELATIVE_PATH}")

    text = manifest_path.read_text(encoding="utf-8")
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ManifestError(f"manifest is not valid YAML: {exc}") from exc

    if data is None:
        data = {}

    for key, value in data.items():
        if key not in CONFIGURABLE_STAGES:
            raise ManifestError(
                f"manifest has unknown stage '{key}'; allowed: lint, build, test"
            )
        if not isinstance(value, dict):
            raise ManifestError(f"manifest stage '{key}' must be a mapping")
        if "command" not in value:
            raise ManifestError(
                f"manifest stage '{key}' is missing required key 'command'"
            )

    return data


def run_stage_command(command: str, working_dir: Path) -> int:
    """Run a shell command, streaming its output straight through."""
    result = subprocess.run(command, shell=True, cwd=working_dir)
    return result.returncode


def run_lint(command: str, working_dir: Path) -> int:
    return run_stage_command(command, working_dir)


def run_build(command: str, working_dir: Path) -> int:
    return run_stage_command(command, working_dir)


def run_test(command: str, working_dir: Path) -> int:
    return run_stage_command(command, working_dir)


def run_gitleaks(repo_root: Path) -> int:
    return run_stage_command("gitleaks detect --source . --no-banner", repo_root)


def run_trivy(repo_root: Path) -> int:
    return run_stage_command(
        "trivy fs --scanners vuln --exit-code 1 --severity HIGH,CRITICAL .", repo_root
    )


def run_pipeline(repo_root: Path) -> int:
    try:
        manifest = load_manifest(repo_root)
    except ManifestError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    # Built here, not at module level: a dict built at import time would
    # freeze in the original functions, bypassing unittest.mock.patch.object
    # on the module's run_<stage> names. Building it at call time means each
    # lookup below resolves through the module namespace fresh, same as a
    # bare `run_lint(...)` call would.
    stage_functions = {
        "lint": run_lint,
        "gitleaks": run_gitleaks,
        "trivy": run_trivy,
        "build": run_build,
        "test": run_test,
    }

    for stage in STAGE_ORDER:
        if stage in CONFIGURABLE_STAGES:
            stage_config = manifest.get(stage)
            if stage_config is None:
                print(f"{stage}: skipped")
                continue
            working_dir = repo_root / stage_config.get("working-dir", ".")
            exit_code = stage_functions[stage](stage_config["command"], working_dir)
        else:
            exit_code = stage_functions[stage](repo_root)

        if exit_code != 0:
            print(f"pipeline failed at: {stage}")
            return exit_code

        print(f"{stage}: passed")

    print("pipeline passed")
    return 0


def main(argv: list[str]) -> int:
    repo_root = Path(argv[1]) if len(argv) > 1 else Path.cwd()
    return run_pipeline(repo_root)


if __name__ == "__main__":
    sys.exit(main(sys.argv))

