package app_test

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"boy/internal/app"
	"boy/internal/client"
	"boy/internal/picker"
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
	if title := e.fake.Sessions[sessionID].Title; title != "" {
		t.Errorf("session title = %q, want none", title)
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
	if _, has := prompt["delivery"]; has {
		t.Errorf("prompt delivery = %v, want none", prompt["delivery"])
	}

	en := e.startEntry()
	if en.Plan == nil {
		t.Fatalf("stdout entry plan is null, want %s", plan)
	}
	if en.Session != sessionID || *en.Plan != plan || en.Branch != plan || en.Worktree != wt {
		t.Errorf("stdout entry = session %s plan %s branch %s worktree %s, want %s / %s / %s / %s",
			en.Session, *en.Plan, en.Branch, en.Worktree, sessionID, plan, plan, wt)
	}
	if want := "plan " + plan + " started at " + wt + "\n"; e.stderr.String() != want {
		t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
	}
}

func TestStartCreatesWorktreeAndLaunchesCoder(t *testing.T) {
	for _, path := range []string{".agents/plans/p", ".agents/plans/p/"} {
		t.Run("path "+path, func(t *testing.T) {
			e := newEnv(t, "p")
			before := e.gitState()

			if err := e.start(path); err != nil {
				t.Fatalf("start: %v", err)
			}
			assertStarted(t, e, before, "p")
		})
	}
}

func TestStartPlanFromAnywhere(t *testing.T) {
	e := newEnv(t, "p")
	e.workDir = t.TempDir() // outside the repo
	planPath := filepath.Join(e.repo, ".agents", "plans", "p")
	before := e.gitState()

	if err := e.start(planPath); err != nil {
		t.Fatalf("start: %v", err)
	}
	assertStarted(t, e, before, "p")
}

func TestAdhocStartLaunchesCoder(t *testing.T) {
	e := newEnv(t) // no plans: a clean main checkout
	const prompt = "Fix the auth typo in login.go, please!"
	before := e.gitState()

	if err := e.startPrompt(prompt); err != nil {
		t.Fatalf("start: %v", err)
	}
	assertAdhocStarted(t, e, prompt, before)
}

// assertAdhocStarted checks the git state, the recorded calls, the entry and
// the stderr message for a freshly started ad-hoc coder for prompt.
func assertAdhocStarted(t *testing.T, e *env, prompt string, before gitState) {
	t.Helper()
	name := app.AdhocName(prompt, t0)
	wt := e.worktree(name)

	// start-creates-worktree, with an ad-hoc name
	if !strings.Contains(e.git("worktree", "list", "--porcelain"), "worktree "+wt+"\n") {
		t.Errorf("git worktree list lacks %s", wt)
	}
	if got := testutil.Git(t, wt, "branch", "--show-current"); got != name {
		t.Errorf("worktree branch = %q, want %q", got, name)
	}
	if got := e.git("rev-parse", name); got != before.head {
		t.Errorf("branch %s tip = %s, want main HEAD %s", name, got, before.head)
	}
	after := e.gitState()
	if after.head != before.head || after.branch != before.branch || after.status != before.status {
		t.Errorf("main checkout changed: before %+v, after %+v", before, after)
	}

	// One server call happens before any git change, then one session, one
	// refresh and one prompt.
	if got, want := callNames(e.fake)[0], "ActiveSessionIDs"; got != want {
		t.Errorf("first client call = %s, want %s", got, want)
	}
	if got, want := mutations(e.fake), []string{"CreateSession", "RefreshWorktrees", "SendPrompt"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("state-changing calls = %v, want %v", got, want)
	}
	create := e.fake.CallsTo("CreateSession")[0].Args["request"].(client.CreateSessionRequest)
	if create.Directory != wt {
		t.Errorf("session directory = %q, want %q", create.Directory, wt)
	}
	var sessionID string
	for id := range e.fake.Sessions {
		sessionID = id
	}
	if title := e.fake.Sessions[sessionID].Title; title != "" {
		t.Errorf("session title = %q, want none", title)
	}
	promptArgs := e.fake.CallsTo("SendPrompt")[0].Args
	if promptArgs["session"] != sessionID {
		t.Errorf("prompt sent to %v, want %s", promptArgs["session"], sessionID)
	}
	if text, _ := promptArgs["text"].(string); text != prompt {
		t.Errorf("prompt text = %q, want %q", text, prompt)
	}
	if _, has := promptArgs["delivery"]; has {
		t.Errorf("prompt delivery = %v, want none", promptArgs["delivery"])
	}

	// The entry has no plan and no tasks, but the ad-hoc branch and worktree.
	en := e.startEntry()
	if en.Plan != nil || en.Tasks != nil {
		t.Errorf("entry plan/tasks = %v/%v, want null/null", en.Plan, en.Tasks)
	}
	if en.Branch != name || en.Worktree != wt || en.Session != sessionID {
		t.Errorf("entry branch/worktree/session = %s/%s/%s, want %s/%s/%s", en.Branch, en.Worktree, en.Session, name, wt, sessionID)
	}
	if want := "ad-hoc " + name + " started at " + wt + "\n"; e.stderr.String() != want {
		t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
	}
}

func TestStartRejectsInvalidRequest(t *testing.T) {
	cases := []struct {
		name  string
		setup func(e *env) app.StartOptions
		// coder is the coder name the request refers to, for the worktree
		// check; empty when no coder would be created.
		coder string
		want  func(e *env) string
	}{
		{
			name: "current directory is not a git repository (prompt)",
			setup: func(e *env) app.StartOptions {
				e.workDir = e.t.TempDir()
				return app.StartOptions{Prompt: "do it"}
			},
			want: func(e *env) string { return "not a git repository: " + e.workDir },
		},
		{
			name: "path is not inside a git repository",
			setup: func(e *env) app.StartOptions {
				e.workDir = e.t.TempDir()
				testutil.WriteFile(e.t, filepath.Join(e.workDir, ".agents", "plans", "p", "TODO.md"), "x")
				return app.StartOptions{Plan: ".agents/plans/p"}
			},
			coder: "p",
			want:  func(*env) string { return "not a git repository: .agents/plans/p" },
		},
		{
			name:  "path does not exist",
			setup: func(*env) app.StartOptions { return app.StartOptions{Plan: "nope"} },
			coder: "nope",
			want:  func(*env) string { return "plan not found: nope" },
		},
		{
			name: "archived plan",
			setup: func(e *env) app.StartOptions {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "archive", "old", "TODO.md"), "x")
				e.git("add", "-A")
				e.git("commit", "-q", "-m", "archive")
				return app.StartOptions{Plan: ".agents/plans/archive/old"}
			},
			coder: "old",
			want:  func(*env) string { return "not an active plan: .agents/plans/archive/old" },
		},
		{
			name: "plan has a modified file",
			setup: func(e *env) app.StartOptions {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "p", "TODO.md"), "changed\n")
				return app.StartOptions{Plan: ".agents/plans/p"}
			},
			coder: "p",
			want:  func(*env) string { return "plan has uncommitted changes: p" },
		},
		{
			name: "plan has an untracked file",
			setup: func(e *env) app.StartOptions {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "p", "NOTES.md"), "new\n")
				return app.StartOptions{Plan: ".agents/plans/p"}
			},
			coder: "p",
			want:  func(*env) string { return "plan has uncommitted changes: p" },
		},
		{
			name: "branch exists without a worktree",
			setup: func(e *env) app.StartOptions {
				e.git("branch", "p")
				return app.StartOptions{Plan: ".agents/plans/p"}
			},
			coder: "p",
			want:  func(*env) string { return "branch exists without worktree: p" },
		},
		{
			name:  "both a plan and a prompt",
			setup: func(*env) app.StartOptions { return app.StartOptions{Plan: ".agents/plans/p", Prompt: "do it"} },
			coder: "p",
			want:  func(*env) string { return "pass a plan or a prompt, not both" },
		},
		{
			name:  "blank prompt",
			setup: func(*env) app.StartOptions { return app.StartOptions{Prompt: "   "} },
			want:  func(*env) string { return "prompt required" },
		},
		{
			name: "no arguments and no terminal",
			setup: func(e *env) app.StartOptions {
				// A picker that fails loudly if the command opens it.
				e.picker = &picker.Fake{ChooseErr: errors.New("picker called")}
				return app.StartOptions{}
			},
			want: func(*env) string { return "plan or prompt required" },
		},
		{
			name: "server unreachable (plan)",
			setup: func(e *env) app.StartOptions {
				e.fake.Failures["*"] = client.ErrUnreachable
				return app.StartOptions{Plan: ".agents/plans/p"}
			},
			coder: "p",
			want:  func(*env) string { return "opencode server unreachable: " + serverURL },
		},
		{
			name: "server unreachable (prompt)",
			setup: func(e *env) app.StartOptions {
				e.fake.Failures["*"] = client.ErrUnreachable
				return app.StartOptions{Prompt: "do it"}
			},
			coder: app.AdhocName("do it", t0),
			want:  func(*env) string { return "opencode server unreachable: " + serverURL },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			opts := tc.setup(e)
			before := e.gitState()

			err := e.startOpts(opts)

			if err == nil {
				t.Fatal("start succeeded, want an error")
			}
			if want := tc.want(e); err.Error() != want {
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
			if e.picker != nil && e.picker.Called {
				t.Error("the picker was called, want none")
			}
			if tc.coder != "" {
				if _, statErr := os.Stat(filepath.Join(e.workDir, ".agents", "worktrees", tc.coder)); statErr == nil {
					t.Errorf("worktree for %s exists", tc.coder)
				}
			}
		})
	}
}

func TestStartIsIdempotent(t *testing.T) {
	// startedCoder starts plan p once and clears the recorded calls, so the
	// second start's calls stand alone.
	startedCoder := func(t *testing.T) (*env, string, gitState) {
		e := newEnv(t, "p")
		if err := e.start(".agents/plans/p"); err != nil {
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

		if err := e.start(".agents/plans/p"); err != nil {
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

		if err := e.start(".agents/plans/p"); err != nil {
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

		if err := e.start(".agents/plans/p"); err != nil {
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

		if err := e.start(".agents/plans/p"); err != nil {
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
