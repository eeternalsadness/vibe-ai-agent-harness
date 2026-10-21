"""
Integration tests for the runner's trivy and gitleaks stages (plan 19).

Runs the real pipeline_runner stage functions — real trivy and gitleaks, no
mocks — against small repos. Kept out of test_pipeline_runner.py (which mocks
every stage) for the same reason as test_pipeline_runner_conforms.py: it needs
the real tools on PATH.

The vulnerable lockfile is a committed fixture, stored as
test/fixtures/runner/vulnerable-package-lock.json.txt so this repo's own trivy
scan does not flag it. Tests copy it into a temp directory under its real
name. The gitleaks repo needs branches, so it is built in a temp directory.

Requires gitleaks, trivy and git installed on PATH.

Run directly: python3 test/integration/test_pipeline_runner_real_tools.py -v
"""

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "src/global/skills/validating-work/scripts"
FIXTURE_LOCKFILE = REPO_ROOT / "test/fixtures/runner/vulnerable-package-lock.json.txt"
sys.path.insert(0, str(SCRIPTS_DIR))

import pipeline_runner as pr

# Built from pieces so this file does not trip gitleaks on this repo's own scan.
LEAKED_SECRET = "ghp" + "_" + "R7kQ2mZx9LpVc4TnYb8WdFhJs3GuAe6XoN1i"


def git(repo: Path, *args: str) -> None:
    subprocess.run(
        ["git", "-C", str(repo), "-c", "user.email=t@example.com", "-c", "user.name=T",
         "-c", "commit.gpgsign=false", *args],
        check=True, capture_output=True,
    )


class RunnerSkipsWorktreesTest(unittest.TestCase):
    """Scenario: runner-skips-worktrees"""

    def run_trivy_with_lockfile_in(self, relative_dir: str) -> int:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / relative_dir
            target.mkdir(parents=True)
            shutil.copy(FIXTURE_LOCKFILE, target / "package-lock.json")
            return pr.run_trivy(Path(tmp))

    def test_fixture_lockfile_is_flagged_outside_worktrees(self):
        # Control: proves the fixture really is vulnerable, so the next test means something.
        self.assertNotEqual(self.run_trivy_with_lockfile_in("app"), 0)

    def test_trivy_passes_when_only_worktrees_hold_the_vulnerable_lockfile(self):
        self.assertEqual(self.run_trivy_with_lockfile_in(".agents/worktrees/some-plan"), 0)


class GitleaksScansCurrentBranchTest(unittest.TestCase):
    """Scenario: gitleaks-scans-current-branch"""

    def test_secret_on_another_branch_is_ignored_until_that_branch_is_checked_out(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            git(repo, "init", "-q", "-b", "main")
            (repo / "README.md").write_text("clean\n", encoding="utf-8")
            git(repo, "add", "-A")
            git(repo, "commit", "-q", "-m", "clean")

            git(repo, "checkout", "-q", "-b", "leaky")
            (repo / "config.txt").write_text(f"token = {LEAKED_SECRET}\n", encoding="utf-8")
            git(repo, "add", "-A")
            git(repo, "commit", "-q", "-m", "leak")

            git(repo, "checkout", "-q", "main")
            self.assertEqual(pr.run_gitleaks(repo), 0)

            git(repo, "checkout", "-q", "leaky")
            self.assertNotEqual(pr.run_gitleaks(repo), 0)


if __name__ == "__main__":
    unittest.main()
