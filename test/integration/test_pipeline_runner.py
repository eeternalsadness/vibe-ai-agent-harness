"""
Behavioral tests for the validation pipeline runner (plan 18).

Imports pipeline_runner.py directly and mocks its stage functions with
unittest.mock, per the Runner Design section of ACCEPTANCE.md. The real
gitleaks/trivy/lint/build/test commands are never invoked here — see
test_pipeline_runner_conforms.py for the real, unmocked integration check.

Manifest fixtures live in test/fixtures/pipeline/<case>/, one directory per
scenario case, mirroring the test/fixtures/knowledge-base/ convention.

Run directly: python3 test/integration/test_pipeline_runner.py -v
"""

import io
import sys
import unittest
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "src/global/skills/validating-work/scripts"
FIXTURES_DIR = REPO_ROOT / "test/fixtures/pipeline"
sys.path.insert(0, str(SCRIPTS_DIR))

import pipeline_runner as pr  # noqa: E402


def run_runner(fixture: str) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = pr.run_pipeline(FIXTURES_DIR / fixture)
    return code, out.getvalue(), err.getvalue()


class RunnerRejectsMalformedManifestTest(unittest.TestCase):
    """Scenario: runner-rejects-malformed-manifest"""

    def run_with_all_stages_mocked(self, fixture: str):
        with mock.patch.object(pr, "run_lint") as lint_m, \
             mock.patch.object(pr, "run_gitleaks") as gitleaks_m, \
             mock.patch.object(pr, "run_trivy") as trivy_m, \
             mock.patch.object(pr, "run_build") as build_m, \
             mock.patch.object(pr, "run_test") as test_m:
            code, out, err = run_runner(fixture)
            for m in (lint_m, gitleaks_m, trivy_m, build_m, test_m):
                m.assert_not_called()
        return code, out, err

    def test_manifest_missing_entirely(self):
        code, _out, err = self.run_with_all_stages_mocked("missing-manifest")

        self.assertNotEqual(code, 0)
        self.assertEqual(err.strip(), "manifest not found: .agents/pipeline.yaml")

    def test_manifest_not_valid_yaml(self):
        code, _out, err = self.run_with_all_stages_mocked("invalid-yaml")

        self.assertNotEqual(code, 0)
        self.assertTrue(err.strip().startswith("manifest is not valid YAML:"))

    def test_stage_missing_required_command(self):
        code, _out, err = self.run_with_all_stages_mocked("missing-command")

        self.assertNotEqual(code, 0)
        self.assertEqual(err.strip(), "manifest stage 'lint' is missing required key 'command'")

    def test_unknown_top_level_stage_key(self):
        code, _out, err = self.run_with_all_stages_mocked("unknown-stage")

        self.assertNotEqual(code, 0)
        self.assertEqual(err.strip(), "manifest has unknown stage 'deploy'; allowed: lint, build, test")

    def test_stage_value_not_a_mapping(self):
        code, _out, err = self.run_with_all_stages_mocked("not-a-mapping")

        self.assertNotEqual(code, 0)
        self.assertEqual(err.strip(), "manifest stage 'lint' must be a mapping")


class RunnerRunsStagesFailFastOrderTest(unittest.TestCase):
    """Scenario: runner-runs-stages-fail-fast-order"""

    def test_stages_run_in_fixed_order(self):
        call_order: list[str] = []

        def recorder(name):
            def _stage(*_args, **_kwargs):
                call_order.append(name)
                return 0
            return _stage

        with mock.patch.object(pr, "run_lint", side_effect=recorder("lint")), \
             mock.patch.object(pr, "run_gitleaks", side_effect=recorder("gitleaks")), \
             mock.patch.object(pr, "run_trivy", side_effect=recorder("trivy")), \
             mock.patch.object(pr, "run_build", side_effect=recorder("build")), \
             mock.patch.object(pr, "run_test", side_effect=recorder("test")):
            code, _out, _err = run_runner("fixed-order")

        self.assertEqual(code, 0)
        self.assertEqual(call_order, ["lint", "gitleaks", "trivy", "build", "test"])


class RunnerFailsFastOnFirstFailureTest(unittest.TestCase):
    """Scenario: runner-fails-fast-on-first-failure"""

    def run_failing_at(self, failing_stage: str):
        call_order: list[str] = []

        def recorder(name, exit_code):
            def _stage(*_args, **_kwargs):
                call_order.append(name)
                return exit_code
            return _stage

        stage_exit_codes = {"lint": 0, "gitleaks": 0, "trivy": 0, "build": 0, "test": 0}
        stage_exit_codes[failing_stage] = 1

        with mock.patch.object(pr, "run_lint", side_effect=recorder("lint", stage_exit_codes["lint"])), \
             mock.patch.object(pr, "run_gitleaks", side_effect=recorder("gitleaks", stage_exit_codes["gitleaks"])), \
             mock.patch.object(pr, "run_trivy", side_effect=recorder("trivy", stage_exit_codes["trivy"])), \
             mock.patch.object(pr, "run_build", side_effect=recorder("build", stage_exit_codes["build"])), \
             mock.patch.object(pr, "run_test", side_effect=recorder("test", stage_exit_codes["test"])):
            code, out, err = run_runner("fixed-order")

        return code, out, err, call_order

    def test_fails_at_lint_the_first_stage(self):
        code, out, _err, call_order = self.run_failing_at("lint")

        self.assertNotEqual(code, 0)
        self.assertIn("pipeline failed at: lint", out)
        self.assertEqual(call_order, ["lint"])

    def test_fails_at_gitleaks_a_scan_stage(self):
        code, out, _err, call_order = self.run_failing_at("gitleaks")

        self.assertNotEqual(code, 0)
        self.assertIn("pipeline failed at: gitleaks", out)
        self.assertEqual(call_order, ["lint", "gitleaks"])

    def test_fails_at_build_after_the_scans(self):
        code, out, _err, call_order = self.run_failing_at("build")

        self.assertNotEqual(code, 0)
        self.assertIn("pipeline failed at: build", out)
        self.assertEqual(call_order, ["lint", "gitleaks", "trivy", "build"])


class RunnerEmitsSuccessSummaryTest(unittest.TestCase):
    """Scenario: runner-emits-success-summary"""

    def test_success_summary_lists_every_stage_then_pipeline_passed(self):
        with mock.patch.object(pr, "run_lint", return_value=0), \
             mock.patch.object(pr, "run_gitleaks", return_value=0), \
             mock.patch.object(pr, "run_trivy", return_value=0), \
             mock.patch.object(pr, "run_build", return_value=0), \
             mock.patch.object(pr, "run_test", return_value=0):
            code, out, _err = run_runner("fixed-order")

        self.assertEqual(code, 0)
        lines = [line for line in out.splitlines() if line.strip()]
        self.assertEqual(
            lines,
            [
                "lint: passed",
                "gitleaks: passed",
                "trivy: passed",
                "build: passed",
                "test: passed",
                "pipeline passed",
            ],
        )


class RunnerSkipsUnconfiguredStageTest(unittest.TestCase):
    """Scenario: runner-skips-unconfigured-stage"""

    def test_lint_skipped_when_not_configured(self):
        with mock.patch.object(pr, "run_lint", return_value=0) as lint_m, \
             mock.patch.object(pr, "run_gitleaks", return_value=0), \
             mock.patch.object(pr, "run_trivy", return_value=0), \
             mock.patch.object(pr, "run_build", return_value=0), \
             mock.patch.object(pr, "run_test", return_value=0):
            code, out, _err = run_runner("skip-lint")
            lint_m.assert_not_called()

        self.assertEqual(code, 0)
        lines = [line for line in out.splitlines() if line.strip()]
        self.assertEqual(
            lines,
            [
                "lint: skipped",
                "gitleaks: passed",
                "trivy: passed",
                "build: passed",
                "test: passed",
                "pipeline passed",
            ],
        )


if __name__ == "__main__":
    unittest.main()
