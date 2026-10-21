"""
Integration test for the main-pipeline-ignores-worktrees scenario (plan 19).

Clones this repo's HEAD, plants a coder worktree full of failures under
.agents/worktrees/, and runs the real pipeline_runner at the clone's root —
real lint, gitleaks, trivy, build and test. The runner must pass: a coder's
unfinished work never breaks the main checkout's checks.

The planted files are committed as *.txt fixtures in
test/fixtures/worktree-noise/ (so this repo's own checks do not see them) and
copied into the clone under their real names. The vulnerable lockfile is
shared with test_pipeline_runner_real_tools.py.

Kept out of the repo's own `test` command, like test_pipeline_runner_conforms.py,
because it runs the whole pipeline. Requires git, bun, go, uv, biome's
dependencies in node_modules, gitleaks, trivy and shellcheck on PATH.

Run directly: python3 test/integration/test_pipeline_runner_worktrees.py -v
"""

import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "src/global/skills/validating-work/scripts"
NOISE_DIR = REPO_ROOT / "test/fixtures/worktree-noise"
LOCKFILE = REPO_ROOT / "test/fixtures/runner/vulnerable-package-lock.json.txt"
sys.path.insert(0, str(SCRIPTS_DIR))

import pipeline_runner as pr


class MainPipelineIgnoresWorktreesTest(unittest.TestCase):
    """Scenario: main-pipeline-ignores-worktrees"""

    def test_runner_passes_with_a_broken_worktree_inside_the_repo(self):
        with tempfile.TemporaryDirectory() as tmp:
            clone = Path(tmp) / "repo"
            subprocess.run(
                ["git", "clone", "-q", "--local", str(REPO_ROOT), str(clone)],
                check=True,
            )
            # node_modules is gitignored, so the clone has none; reuse ours.
            (clone / "node_modules").symlink_to(REPO_ROOT / "node_modules")

            worktree = clone / ".agents/worktrees/broken-plan"
            worktree.mkdir(parents=True)
            for fixture in NOISE_DIR.glob("*.txt"):
                shutil.copy(fixture, worktree / fixture.name.removesuffix(".txt"))
            shutil.copy(LOCKFILE, worktree / "package-lock.json")

            self.assertEqual(pr.run_pipeline(clone), 0)


if __name__ == "__main__":
    unittest.main()
