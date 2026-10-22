package app_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"boy/internal/app"
	"boy/internal/client"
	"boy/internal/picker"
	"boy/internal/testutil"
)

const serverURL = "http://opencode.test"

// t0 is the fixed time the test clock starts at.
var t0 = time.Date(2026, 10, 21, 10, 0, 0, 0, time.UTC)

// env is one repo, one fake opencode client and one clock.
type env struct {
	t      *testing.T
	repo   string
	fake   *client.Fake
	clock  *testutil.Clock
	stdout bytes.Buffer
	stderr bytes.Buffer
	// workDir is where commands run from; it defaults to repo.
	workDir string
	// picker is the chooser a command may open; nil when untested.
	picker *picker.Fake
	// interactive says the command sees a terminal on stdin.
	interactive bool
}

func newEnv(t *testing.T, plans ...string) *env {
	t.Helper()
	clock := testutil.NewClock(t0)
	repo := testutil.NewRepo(t, plans...)
	return &env{t: t, repo: repo, fake: client.NewFake(clock.Now), clock: clock, workDir: repo}
}

// otherRepo creates a second repo that shares this env's fake client and clock.
func (e *env) otherRepo(plans ...string) *env {
	e.t.Helper()
	repo := testutil.NewRepo(e.t, plans...)
	return &env{t: e.t, repo: repo, fake: e.fake, clock: e.clock, workDir: repo}
}

func (e *env) deps() app.Deps {
	e.stdout.Reset()
	e.stderr.Reset()
	return app.Deps{
		Client:    e.fake,
		Now:       e.clock.Now,
		Stdout:    &e.stdout,
		Stderr:    &e.stderr,
		WorkDir:   e.workDir,
		ServerURL: serverURL,
		Picker:    e.picker,
		Interactive: e.interactive,
		// These tests parse the stdout as JSON, so ask for it explicitly. The
		// human-table default lands with its own task.
		Output: "json",
	}
}

// start runs `boy start --plan <planPath>`.
func (e *env) start(planPath string) error {
	e.t.Helper()
	return e.startOpts(app.StartOptions{Plan: planPath})
}

// startPrompt runs `boy start "<prompt>"`.
func (e *env) startPrompt(prompt string) error {
	e.t.Helper()
	return e.startOpts(app.StartOptions{Prompt: prompt})
}

// startOpts runs `boy start` with the given options.
func (e *env) startOpts(opts app.StartOptions) error {
	e.t.Helper()
	return app.Start(e.t.Context(), e.deps(), opts)
}

func (e *env) status(opts app.StatusOptions) error {
	e.t.Helper()
	return app.Status(e.t.Context(), e.deps(), opts)
}

func (e *env) remove(sessionID string, force bool) error {
	e.t.Helper()
	return app.Remove(e.t.Context(), e.deps(), sessionID, force)
}

func (e *env) worktree(plan string) string {
	return filepath.Join(e.repo, ".agents", "worktrees", plan)
}

func (e *env) git(args ...string) string {
	e.t.Helper()
	return testutil.Git(e.t, e.repo, args...)
}

// entry mirrors the status JSON documented in ACCEPTANCE.md. It is declared
// here, not imported, so the tests pin the output format.
type entry struct {
	Session  string  `json:"session"`
	Repo     string  `json:"repo"`
	Worktree string  `json:"worktree"`
	Title    string  `json:"title"`
	Plan     *string `json:"plan"`
	Branch   string  `json:"branch"`
	Tasks    *struct {
		Done    int `json:"done"`
		Skipped int `json:"skipped"`
		Total   int `json:"total"`
	} `json:"tasks"`
	State      string  `json:"state"`
	Outcome    *string `json:"outcome"`
	StartedAt  string  `json:"started_at"`
	StateSince string  `json:"state_since"`
	RunningFor int     `json:"running_for"`
	InStateFor int     `json:"in_state_for"`
}

func (e *env) startEntry() entry {
	e.t.Helper()
	var en entry
	if err := json.Unmarshal(e.stdout.Bytes(), &en); err != nil {
		e.t.Fatalf("stdout is not a JSON object: %v\n%s", err, e.stdout.String())
	}
	return en
}

func (e *env) statusEntries() []entry {
	e.t.Helper()
	var out []entry
	if err := json.Unmarshal(e.stdout.Bytes(), &out); err != nil {
		e.t.Fatalf("stdout is not a JSON array: %v\n%s", err, e.stdout.String())
	}
	return out
}

// gitState is the repo facts a failed or idempotent command must leave alone.
type gitState struct {
	worktrees string
	branches  string
	head      string
	branch    string
	status    string
}

func (e *env) gitState() gitState {
	e.t.Helper()
	return gitState{
		worktrees: e.git("worktree", "list", "--porcelain"),
		branches:  e.git("branch", "--format=%(refname:short)"),
		head:      e.git("rev-parse", "HEAD"),
		branch:    e.git("branch", "--show-current"),
		status:    e.git("status", "--porcelain"),
	}
}

// callNames lists the recorded client call names in order.
func callNames(f *client.Fake) []string {
	var names []string
	for _, c := range f.Calls {
		names = append(names, c.Name)
	}
	return names
}

// writeTodo replaces the TODO.md of a plan inside a worktree.
func writeTodo(t *testing.T, worktree, plan, content string) {
	t.Helper()
	testutil.WriteFile(t, filepath.Join(worktree, ".agents", "plans", plan, "TODO.md"), content)
}

func todoWith(lines ...string) string {
	return "# TODO\n\n" + strings.Join(lines, "\n") + "\n"
}

func mustExist(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected %s to exist: %v", path, err)
	}
}
