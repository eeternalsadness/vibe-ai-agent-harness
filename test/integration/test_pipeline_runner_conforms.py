"""
Integration test for the this-repo-conforms scenario (plan 18).

Runs the real pipeline_runner against this actual repo's committed
.agents/pipeline.yaml — real gitleaks and trivy scans, no mocks. This is
deliberately kept out of test_pipeline_runner.py (which mocks every stage)
and out of the repo's own `test` command, to avoid recursively re-invoking
`bun test` from inside a `bun test` run.

Requires gitleaks and trivy installed on PATH.

Run directly: python3 test/integration/test_pipeline_runner_conforms.py -v
"""

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "src/global/skills/validating-work/scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import pipeline_runner as pr


class ThisRepoConformsTest(unittest.TestCase):
    """Scenario: this-repo-conforms"""

    def test_runner_passes_against_this_repos_own_manifest(self):
        code = pr.run_pipeline(REPO_ROOT)

        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
