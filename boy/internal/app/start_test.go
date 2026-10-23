package app_test

import (
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"boy/internal/app"
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

// assertWorktree checks the worktree, branch and untouched main checkout
// (start-creates-worktree) for a freshly started coder called name.
func assertWorktree(t *testing.T, e *env, before gitState, name string) {
	t.Helper()
	wt := e.worktree(name)

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
}

// assertLaunched checks the server calls and printed entry of a freshly
// started coder (start-launches-coder) and returns the printed entry. It
// expects exactly one session and one prompt with the given text.
func assertLaunched(t *testing.T, e *env, name, wantPrompt, wantMessage string) entry {
	t.Helper()
	wt := e.worktree(name)

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
	if prompt["delivery"] != "" {
		t.Errorf("prompt delivery = %q, want none", prompt["delivery"])
	}
	text, _ := prompt["text"].(string)
	if wantPrompt != "" && text != wantPrompt {
		t.Errorf("prompt = %q, want %q", text, wantPrompt)
	}
	if wantPrompt == "" && !strings.Contains(text, name) {
		t.Errorf("prompt %q does not name the plan %q", text, name)
	}

	en := e.startEntry()
	if en.Session != sessionID || en.Worktree != wt || en.Branch != name || en.Repo != e.repo || en.Title != "" {
		t.Errorf("stdout entry = %+v, want session %s worktree %s branch %s", en, sessionID, wt, name)
	}
	if e.stderr.String() != wantMessage+"\n" {
		t.Errorf("stderr = %q, want %q", e.stderr.String(), wantMessage+"\n")
	}
	return en
}

// assertPlanStarted runs start-creates-worktree and start-launches-coder
// for a freshly started plan.
func assertPlanStarted(t *testing.T, e *env, before gitState, plan string) {
	t.Helper()
	assertWorktree(t, e, before, plan)
	en := assertLaunched(t, e, plan, "", "plan "+plan+" started at "+e.worktree(plan))
	if en.Plan == nil || *en.Plan != plan {
		t.Errorf("stdout entry plan = %v, want %s", en.Plan, plan)
	}
	if en.Tasks == nil || en.Tasks.Total != 5 {
		t.Errorf("stdout entry tasks = %+v, want 5 tasks", en.Tasks)
	}
}

func TestStartCreatesWorktreeAndLaunchesCoder(t *testing.T) {
	for _, tc := range []struct{ name, path string }{
		{"relative path", filepath.Join(".agents", "plans", "p")},
		{"relative path with a trailing slash", filepath.Join(".agents", "plans", "p") + "/"},
		{"absolute path", ""}, // filled in below: it needs the repo
	} {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			path := tc.path
			if path == "" {
				path = e.planPath("p")
			}
			before := e.gitState()

			if err := e.start(path); err != nil {
				t.Fatalf("start --plan %s: %v", path, err)
			}
			assertPlanStarted(t, e, before, "p")
		})
	}
}

func TestStartPlanFromAnywhere(t *testing.T) {
	e := newEnv(t, "p")
	e.workDir = t.TempDir() // outside the repo
	before := e.gitState()

	if err := e.start(e.planPath("p")); err != nil {
		t.Fatalf("start --plan: %v", err)
	}
	assertPlanStarted(t, e, before, "p")
}

const adhocPrompt = "Fix the auth typo in login.go, please!"

func TestAdhocStartLaunchesCoder(t *testing.T) {
	e := newEnv(t)
	before := e.gitState()
	name := wantAdhocName("fix-the-auth-typo-in", adhocPrompt, t0)

	if err := e.startAdhoc(adhocPrompt); err != nil {
		t.Fatalf("start: %v", err)
	}

	assertWorktree(t, e, before, name)
	en := assertLaunched(t, e, name, adhocPrompt, "ad-hoc "+name+" started at "+e.worktree(name))
	if en.Plan != nil || en.Tasks != nil {
		t.Errorf("stdout entry plan/tasks = %v/%v, want null/null", en.Plan, en.Tasks)
	}
}

func TestAdhocStartFromSubdirectory(t *testing.T) {
	e := newEnv(t)
	e.workDir = filepath.Join(e.repo, "src")
	testutil.WriteFile(t, filepath.Join(e.workDir, "x.go"), "package x\n")
	e.git("add", "-A")
	e.git("commit", "-q", "-m", "src")
	before := e.gitState()
	name := wantAdhocName("fix-the-auth-typo-in", adhocPrompt, t0)

	if err := e.startAdhoc(adhocPrompt); err != nil {
		t.Fatalf("start: %v", err)
	}
	assertWorktree(t, e, before, name)
}

func TestStartRejectsInvalidRequest(t *testing.T) {
	notRepo := t.TempDir()
	blank := "  \t\n "
	empty := ""

	cases := []struct {
		name  string
		setup func(e *env)
		run   func(e *env) error
		want  func(e *env) string
	}{
		{
			name:  "prompt outside a git repo",
			setup: func(e *env) { e.workDir = notRepo },
			run:   func(e *env) error { return e.startAdhoc("do it") },
			want:  func(*env) string { return "not a git repository: " + notRepo },
		},
		{
			name:  "no arguments outside a git repo",
			setup: func(e *env) { e.workDir = notRepo; e.interactive = true },
			run:   func(e *env) error { return e.startPicker() },
			want:  func(*env) string { return "not a git repository: " + notRepo },
		},
		{
			name: "plan path outside a git repo",
			setup: func(e *env) {
				testutil.WriteFile(e.t, filepath.Join(notRepo, ".agents", "plans", "p", "TODO.md"), "x")
			},
			run:  func(e *env) error { return e.start(filepath.Join(notRepo, ".agents", "plans", "p")) },
			want: func(*env) string { return "not a git repository: " + filepath.Join(notRepo, ".agents", "plans", "p") },
		},
		{
			name: "plan path does not exist",
			run:  func(e *env) error { return e.start(e.planPath("nope")) },
			want: func(e *env) string { return "plan not found: " + e.planPath("nope") },
		},
		{
			name: "relative plan path does not exist",
			run:  func(e *env) error { return e.start(".agents/plans/nope") },
			want: func(*env) string { return "plan not found: .agents/plans/nope" },
		},
		{
			name: "empty plan flag",
			run:  func(e *env) error { return e.start("") },
			want: func(*env) string { return "plan not found: " },
		},
		{
			name: "archived plan",
			setup: func(e *env) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "archive", "old", "TODO.md"), "x")
				e.git("add", "-A")
				e.git("commit", "-q", "-m", "archive")
			},
			run:  func(e *env) error { return e.start(e.planPath("archive/old")) },
			want: func(e *env) string { return "not an active plan: " + e.planPath("archive/old") },
		},
		{
			name: "archive directory itself",
			setup: func(e *env) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "archive", "old", "TODO.md"), "x")
				e.git("add", "-A")
				e.git("commit", "-q", "-m", "archive")
			},
			run:  func(e *env) error { return e.start(".agents/plans/archive") },
			want: func(*env) string { return "not an active plan: .agents/plans/archive" },
		},
		{
			name: "plan inside a worktree",
			setup: func(e *env) {
				// The worktree is an older checkout, so its plan copy is
				// committed and clean: only its location is wrong.
				e.git("worktree", "add", "-q", "-b", "other", e.worktree("other"), "HEAD")
			},
			run: func(e *env) error {
				return e.start(filepath.Join(e.worktree("other"), ".agents", "plans", "p"))
			},
			want: func(e *env) string {
				return "not an active plan: " + filepath.Join(e.worktree("other"), ".agents", "plans", "p")
			},
		},
		{
			name: "directory that is not a plan",
			run:  func(e *env) error { return e.start(filepath.Join(e.repo, ".agents")) },
			want: func(e *env) string { return "not an active plan: " + filepath.Join(e.repo, ".agents") },
		},
		{
			name: "plan has a modified file",
			setup: func(e *env) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "p", "TODO.md"), "changed\n")
			},
			run:  func(e *env) error { return e.startPlan("p") },
			want: func(*env) string { return "plan has uncommitted changes: p" },
		},
		{
			name: "plan has an untracked file",
			setup: func(e *env) {
				testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "p", "NOTES.md"), "new\n")
			},
			run:  func(e *env) error { return e.startPlan("p") },
			want: func(*env) string { return "plan has uncommitted changes: p" },
		},
		{
			name:  "plan branch exists without a worktree",
			setup: func(e *env) { e.git("branch", "p") },
			run:   func(e *env) error { return e.startPlan("p") },
			want:  func(*env) string { return "branch exists without worktree: p" },
		},
		{
			name: "ad-hoc branch exists without a worktree",
			setup: func(e *env) {
				e.git("branch", wantAdhocName("do-it", "do it", t0))
			},
			run:  func(e *env) error { return e.startAdhoc("do it") },
			want: func(*env) string { return "branch exists without worktree: " + wantAdhocName("do-it", "do it", t0) },
		},
		{
			name: "both a plan and a prompt",
			run: func(e *env) error {
				prompt, plan := "do it", e.planPath("p")
				return app.Start(e.t.Context(), e.deps(), app.StartOptions{Plan: &plan, Prompt: &prompt})
			},
			want: func(*env) string { return "pass a plan or a prompt, not both" },
		},
		{
			name: "whitespace prompt",
			run:  func(e *env) error { return e.startAdhoc(blank) },
			want: func(*env) string { return "prompt required" },
		},
		{
			name: "empty prompt",
			run: func(e *env) error {
				return app.Start(e.t.Context(), e.deps(), app.StartOptions{Prompt: &empty})
			},
			want: func(*env) string { return "prompt required" },
		},
		{
			name: "no arguments and no terminal",
			run:  func(e *env) error { return e.startPicker() },
			want: func(*env) string { return "plan or prompt required" },
		},
		{
			name:  "server unreachable for a plan",
			setup: func(e *env) { e.fake.Failures["*"] = client.ErrUnreachable },
			run:   func(e *env) error { return e.startPlan("p") },
			want:  func(*env) string { return "opencode server unreachable: " + serverURL },
		},
		{
			name:  "server unreachable for a prompt",
			setup: func(e *env) { e.fake.Failures["*"] = client.ErrUnreachable },
			run:   func(e *env) error { return e.startAdhoc("do it") },
			want:  func(*env) string { return "opencode server unreachable: " + serverURL },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			if tc.setup != nil {
				tc.setup(e)
			}
			before := e.gitState()
			worktrees := e.git("worktree", "list", "--porcelain")

			err := tc.run(e)

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
			if got := e.git("worktree", "list", "--porcelain"); got != worktrees {
				t.Errorf("worktrees changed: before %q, after %q", worktrees, got)
			}
			if got := mutations(e.fake); len(got) != 0 {
				t.Errorf("state-changing calls = %v, want none", got)
			}
			if len(e.picker.Shown) != 0 && !e.interactive {
				t.Errorf("picker was shown %v without a terminal", e.picker.Shown)
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

// An empty --plan must fail, not fall through to the picker, even with a terminal.
func TestStartEmptyPlanNeverOpensPicker(t *testing.T) {
	e := newEnv(t, "p")
	e.interactive = true

	err := e.start("")

	if err == nil || err.Error() != "plan not found: " {
		t.Fatalf("error = %v, want %q", err, "plan not found: ")
	}
	if len(e.picker.Shown) != 0 {
		t.Errorf("picker was shown %v", e.picker.Shown)
	}
}
