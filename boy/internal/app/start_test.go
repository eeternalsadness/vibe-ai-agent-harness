package app_test

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"boy/internal/client"
	"boy/internal/testutil"
)

// mutations lists the recorded calls that change server state, in order.
func mutations(f *client.Fake) []string {
	changing := map[string]bool{
		"CreateSession": true, "SendPrompt": true, "RefreshWorktrees": true,
		"Interrupt": true, "DeleteSession": true, "RemoveWorktree": true,
	}
	var out []string
	for _, n := range callNames(f) {
		if changing[n] {
			out = append(out, n)
		}
	}
	return out
}

// assertStarted checks the worktree, branch and untouched main checkout
// (start-creates-worktree) and the server calls (start-launches-coder) for a
// freshly started plan.
func assertStarted(t *testing.T, e *env, before gitState, plan string) {
	t.Helper()
	wt := e.worktree(plan)

	// start-creates-worktree
	if !strings.Contains(e.git("worktree", "list", "--porcelain"), "worktree "+wt+"\n") {
		t.Errorf("git worktree list lacks %s", wt)
	}
	if got := testutil.Git(t, wt, "branch", "--show-current"); got != plan {
		t.Errorf("worktree branch = %q, want %q", got, plan)
	}
	if got := e.git("rev-parse", plan); got != before.head {
		t.Errorf("branch %s tip = %s, want main HEAD %s", plan, got, before.head)
	}
	after := e.gitState()
	if after.head != before.head || after.branch != before.branch || after.status != before.status {
		t.Errorf("main checkout changed: before %+v, after %+v", before, after)
	}

	// start-launches-coder
	if got, want := mutations(e.fake), []string{"CreateSession", "RefreshWorktrees", "SendPrompt"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("state-changing calls = %v, want %v", got, want)
	}
	create := e.fake.CallsTo("CreateSession")[0].Args["request"].(client.CreateSessionRequest)
	if create.Directory != wt {
		t.Errorf("session directory = %q, want %q", create.Directory, wt)
	}
	if create.Agent != "coder" {
		t.Errorf("session agent = %q, want coder", create.Agent)
	}
	if len(e.fake.Sessions) != 1 {
		t.Fatalf("server has %d sessions, want 1", len(e.fake.Sessions))
	}
	var sessionID string
	for id := range e.fake.Sessions {
		sessionID = id
	}
	if got := e.fake.CallsTo("RefreshWorktrees")[0].Args["projectID"]; got != e.fake.ProjectID {
		t.Errorf("refresh projectID = %v, want %s", got, e.fake.ProjectID)
	}
	prompt := e.fake.CallsTo("SendPrompt")[0].Args
	if prompt["session"] != sessionID {
		t.Errorf("prompt sent to %v, want %s", prompt["session"], sessionID)
	}
	if text, _ := prompt["text"].(string); !strings.Contains(text, plan) {
		t.Errorf("prompt %q does not name the plan %q", text, plan)
	}

	en := e.startEntry()
	if en.Session != sessionID || en.Plan != plan {
		t.Errorf("stdout entry = session %s plan %s, want %s / %s", en.Session, en.Plan, sessionID, plan)
	}
	if want := "plan " + plan + " started at " + wt + "\n"; e.stderr.String() != want {
		t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
	}
}

func TestStartCreatesWorktreeAndLaunchesCoder(t *testing.T) {
	e := newEnv(t, "p")
	before := e.gitState()

	if err := e.startPlan("p"); err != nil {
		t.Fatalf("start: %v", err)
	}
	assertStarted(t, e, before, "p")
}

func TestStartFromOtherDir(t *testing.T) {
	e := newEnv(t, "p")
	e.workDir = t.TempDir() // outside the repo
	before := e.gitState()

	if err := e.startPlan("p"); err != nil {
		t.Fatalf("start --dir: %v", err)
	}
	assertStarted(t, e, before, "p")
}

func TestStartRejectsInvalidRequest(t *testing.T) {
	notRepo := t.TempDir()

	cases := []struct {
		name  string
		setup func(e *env) (dir, plan string)
		want  func(e *env, dir string) string
	}{
		{
			name:  "dir is not inside a git repo",
			setup: func(e *env) (string, string) { return notRepo, "p" },
			want:  func(_ *env, dir string) string { return "not a git repository: " + dir },
		},
		{
			name:  "plan directory does not exist",
			setup: func(e *env) (string, string) { return "", "nope" },
			want:  func(*env, string) string { return "plan not found: nope" },
		},
		{
			name: "archived plan",
			setup: func(e *env) (string, string) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "archive", "old", "TODO.md"), "x")
				e.git("add", "-A")
				e.git("commit", "-q", "-m", "archive")
				return "", "old"
			},
			want: func(*env, string) string { return "plan not found: old" },
		},
		{
			name: "plan has a modified file",
			setup: func(e *env) (string, string) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "p", "TODO.md"), "changed\n")
				return "", "p"
			},
			want: func(*env, string) string { return "plan has uncommitted changes: p" },
		},
		{
			name: "plan has an untracked file",
			setup: func(e *env) (string, string) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "p", "NOTES.md"), "new\n")
				return "", "p"
			},
			want: func(*env, string) string { return "plan has uncommitted changes: p" },
		},
		{
			name: "branch exists without a worktree",
			setup: func(e *env) (string, string) {
				e.git("branch", "p")
				return "", "p"
			},
			want: func(*env, string) string { return "branch exists without worktree: p" },
		},
		{
			name: "server unreachable",
			setup: func(e *env) (string, string) {
				e.fake.Failures["*"] = client.ErrUnreachable
				return "", "p"
			},
			want: func(*env, string) string { return "opencode server unreachable: " + serverURL },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			dir, plan := tc.setup(e)
			before := e.gitState()

			err := e.start(filepath.Join(dir, ".agents", "plans", plan))

			if err == nil {
				t.Fatal("start succeeded, want an error")
			}
			if want := tc.want(e, dir); err.Error() != want {
				t.Errorf("error = %q, want %q", err.Error(), want)
			}
			if e.stdout.Len() != 0 {
				t.Errorf("stdout = %q, want empty", e.stdout.String())
			}
			if got := e.gitState(); got != before {
				t.Errorf("repo changed: before %+v, after %+v", before, got)
			}
			if got := mutations(e.fake); len(got) != 0 {
				t.Errorf("state-changing calls = %v, want none", got)
			}
			if _, statErr := os.Stat(e.worktree(plan)); statErr == nil {
				t.Errorf("worktree %s exists", e.worktree(plan))
			}
		})
	}
}

func TestStartIsIdempotent(t *testing.T) {
	// startedCoder starts plan p once and clears the recorded calls, so the
	// second start's calls stand alone.
	startedCoder := func(t *testing.T) (*env, string, gitState) {
		e := newEnv(t, "p")
		if err := e.startPlan("p"); err != nil {
			t.Fatalf("first start: %v", err)
		}
		id := e.startEntry().Session
		e.fake.Calls = nil
		return e, id, e.gitState()
	}

	assertNoNewGit := func(t *testing.T, e *env, before gitState) {
		t.Helper()
		if got := e.gitState(); got != before {
			t.Errorf("repo changed: before %+v, after %+v", before, got)
		}
	}

	t.Run("worktree exists but has no session: creates one", func(t *testing.T) {
		e := newEnv(t, "p")
		e.git("worktree", "add", "-q", "-b", "p", e.worktree("p"), "HEAD")
		before := e.gitState()

		if err := e.startPlan("p"); err != nil {
			t.Fatalf("start: %v", err)
		}

		assertNoNewGit(t, e, before)
		if got, want := mutations(e.fake), []string{"CreateSession", "RefreshWorktrees", "SendPrompt"}; !reflect.DeepEqual(got, want) {
			t.Errorf("state-changing calls = %v, want %v", got, want)
		}
		if want := "plan p started at " + e.worktree("p") + "\n"; e.stderr.String() != want {
			t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
		}
		if id := e.startEntry().Session; id == "" || e.fake.Sessions[id] == nil {
			t.Errorf("stdout entry session %q is not a created session", id)
		}
	})

	t.Run("coder is running: sends nothing", func(t *testing.T) {
		e, id, before := startedCoder(t)

		if err := e.startPlan("p"); err != nil {
			t.Fatalf("start: %v", err)
		}

		assertNoNewGit(t, e, before)
		if got := mutations(e.fake); len(got) != 0 {
			t.Errorf("state-changing calls = %v, want none", got)
		}
		if want := "plan already running: p (session " + id + ")\n"; e.stderr.String() != want {
			t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
		}
		if got := e.startEntry(); got.Session != id || got.State != "running" {
			t.Errorf("stdout entry = %+v, want session %s running", got, id)
		}
	})

	t.Run("coder is idle with tasks left: prompts the same session", func(t *testing.T) {
		e, id, before := startedCoder(t)
		delete(e.fake.Active, id)
		e.fake.Sessions[id].Idle = t0
		e.fake.Sessions[id].Outcome = "succeeded"

		if err := e.startPlan("p"); err != nil {
			t.Fatalf("start: %v", err)
		}

		assertNoNewGit(t, e, before)
		if got, want := mutations(e.fake), []string{"SendPrompt"}; !reflect.DeepEqual(got, want) {
			t.Fatalf("state-changing calls = %v, want %v", got, want)
		}
		if got := e.fake.CallsTo("SendPrompt")[0].Args["session"]; got != id {
			t.Errorf("prompt sent to %v, want %s", got, id)
		}
		if want := "resumed session " + id + " for p\n"; e.stderr.String() != want {
			t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
		}
		if got := e.startEntry().Session; got != id {
			t.Errorf("stdout entry session = %s, want %s", got, id)
		}
	})

	t.Run("coder is idle with every task done or skipped: sends nothing", func(t *testing.T) {
		e, id, _ := startedCoder(t)
		delete(e.fake.Active, id)
		e.fake.Sessions[id].Idle = t0
		e.fake.Sessions[id].Outcome = "succeeded"
		writeTodo(t, e.worktree("p"), "p", todoWith("- [x] **Task 1** - a", "- [-] **Task 2** - b"))
		before := e.gitState()

		if err := e.startPlan("p"); err != nil {
			t.Fatalf("start: %v", err)
		}

		assertNoNewGit(t, e, before)
		if got := mutations(e.fake); len(got) != 0 {
			t.Errorf("state-changing calls = %v, want none", got)
		}
		if want := "plan already finished: p (session " + id + ")\n"; e.stderr.String() != want {
			t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
		}
		if got := e.startEntry(); got.Session != id || got.State != "idle" {
			t.Errorf("stdout entry = %+v, want session %s idle", got, id)
		}
	})
}
