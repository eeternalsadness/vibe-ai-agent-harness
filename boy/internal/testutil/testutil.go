// Package testutil holds helpers shared by boy's tests.
package testutil

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// DefaultTodo is the TODO.md NewRepo commits: five tasks, none done.
const DefaultTodo = "# TODO\n\n- [ ] **Task 1** - one\n- [ ] **Task 2** - two\n- [ ] **Task 3** - three\n- [ ] **Task 4** - four\n- [ ] **Task 5** - five\n"

// Git runs git in dir, fails the test on error, and returns trimmed output.
func Git(t testing.TB, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s in %s: %v\n%s", strings.Join(args, " "), dir, err, out)
	}
	return strings.TrimSpace(string(out))
}

// NewRepo creates a git repo on branch main in a temporary directory, with
// .agents/worktrees/ ignored and each named plan committed under
// .agents/plans/ with DefaultTodo. It returns the repo's resolved path.
func NewRepo(t testing.TB, plans ...string) string {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	Git(t, dir, "init", "-q", "-b", "main")
	Git(t, dir, "config", "user.email", "test@example.com")
	Git(t, dir, "config", "user.name", "Test")
	Git(t, dir, "config", "commit.gpgsign", "false")
	WriteFile(t, filepath.Join(dir, ".gitignore"), ".agents/worktrees/\n")
	for _, plan := range plans {
		WriteFile(t, filepath.Join(dir, ".agents", "plans", plan, "TODO.md"), DefaultTodo)
	}
	Git(t, dir, "add", "-A")
	Git(t, dir, "commit", "-q", "-m", "initial")
	return dir
}

// WriteFile writes content to path, creating parent directories.
func WriteFile(t testing.TB, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// Clock is a settable clock for deterministic timestamps.
type Clock struct {
	mu  sync.Mutex
	now time.Time
}

// NewClock returns a clock reading start.
func NewClock(start time.Time) *Clock { return &Clock{now: start} }

// Now returns the clock's current reading.
func (c *Clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

// Set moves the clock to t.
func (c *Clock) Set(t time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = t
}

// Advance moves the clock forward by d.
func (c *Clock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}
