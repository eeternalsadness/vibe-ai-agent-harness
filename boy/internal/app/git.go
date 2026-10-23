package app

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"boy/internal/client"
)

// git runs git in dir and returns trimmed stdout. A failure carries git's stderr.
func git(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(stderr.String()))
	}
	return strings.TrimSpace(stdout.String()), nil
}

// mainCheckout returns the main checkout of the repo containing dir, even
// when dir is inside one of its linked worktrees.
func mainCheckout(dir string) (string, error) {
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		return "", fmt.Errorf("not a git repository: %s", dir)
	}
	common, err := git(dir, "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return "", fmt.Errorf("not a git repository: %s", dir)
	}
	return filepath.Dir(common), nil
}

// worktreePath is where the coder called name works: a plan's name or an
// ad-hoc name.
func worktreePath(repo, name string) string {
	return filepath.Join(repo, ".agents", "worktrees", name)
}

// planFromWorktree is the inverse of worktreePath: it returns the repo and
// the coder's name (a plan's name or an ad-hoc name, not necessarily a plan)
// for a directory shaped like <repo>/.agents/worktrees/<name>.
func planFromWorktree(dir string) (repo, plan string, ok bool) {
	dir = filepath.Clean(dir)
	worktrees := filepath.Dir(dir)
	agents := filepath.Dir(worktrees)
	if filepath.Base(worktrees) != "worktrees" || filepath.Base(agents) != ".agents" {
		return "", "", false
	}
	return filepath.Dir(agents), filepath.Base(dir), true
}

// isDir reports whether path is an existing directory.
func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// explainServerError turns client errors into the messages commands print.
func (d Deps) explainServerError(err error) error {
	switch {
	case errors.Is(err, client.ErrUnreachable):
		return fmt.Errorf("opencode server unreachable: %s", d.ServerURL)
	case errors.Is(err, client.ErrUnauthorized):
		return fmt.Errorf("opencode server rejected credentials: %s", d.ServerURL)
	default:
		return err
	}
}
