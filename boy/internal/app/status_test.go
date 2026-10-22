package app_test

import (
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"boy/internal/app"
	"boy/internal/client"
)

// startCoder starts a coder for plan in e's repo and returns its session id.
func startCoder(t *testing.T, e *env, plan string) string {
	t.Helper()
	if err := e.start(".agents/plans/" + plan); err != nil {
		t.Fatalf("start %s: %v", plan, err)
	}
	return e.startEntry().Session
}

func sessionIDs(entries []entry) []string {
	var ids []string
	for _, en := range entries {
		ids = append(ids, en.Session)
	}
	sort.Strings(ids)
	return ids
}

func sorted(ids ...string) []string {
	out := append([]string(nil), ids...)
	sort.Strings(out)
	return out
}

func assertSessions(t *testing.T, got []entry, want ...string) {
	t.Helper()
	g, w := sessionIDs(got), sorted(want...)
	if len(g) != len(w) {
		t.Fatalf("entries = %v, want %v", g, w)
	}
	for i := range g {
		if g[i] != w[i] {
			t.Fatalf("entries = %v, want %v", g, w)
		}
	}
}

// threeCoders starts two coders in repo A and one in repo B.
func threeCoders(t *testing.T) (a, b *env, a1, a2, b1 string) {
	t.Helper()
	a = newEnv(t, "p1", "p2")
	b = a.otherRepo("p3")
	a1 = startCoder(t, a, "p1")
	a2 = startCoder(t, a, "p2")
	b1 = startCoder(t, b, "p3")
	return a, b, a1, a2, b1
}

func TestStatusListsRepo(t *testing.T) {
	a, _, a1, a2, _ := threeCoders(t)

	t.Run("inside the repo", func(t *testing.T) {
		if err := a.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		assertSessions(t, a.statusEntries(), a1, a2)
	})

	t.Run("--dir from outside the repo", func(t *testing.T) {
		a.workDir = t.TempDir()
		if err := a.status(app.StatusOptions{Dir: a.repo}); err != nil {
			t.Fatal(err)
		}
		assertSessions(t, a.statusEntries(), a1, a2)
	})
}

func TestStatusListsAll(t *testing.T) {
	a, b, a1, a2, b1 := threeCoders(t)
	a.workDir = t.TempDir()

	// --all and -A set the same option; main_test.go checks the shorthand.
	if err := a.status(app.StatusOptions{All: true}); err != nil {
		t.Fatal(err)
	}
	entries := a.statusEntries()
	assertSessions(t, entries, a1, a2, b1)
	repos := map[string]string{}
	for _, en := range entries {
		repos[en.Session] = en.Repo
	}
	if repos[a1] != a.repo || repos[a2] != a.repo || repos[b1] != b.repo {
		t.Errorf("repos = %v, want %s for A and %s for B", repos, a.repo, b.repo)
	}
}

func TestStatusScopedToSession(t *testing.T) {
	a, b, _, _, b1 := threeCoders(t)

	if err := a.status(app.StatusOptions{SessionID: b1}); err != nil {
		t.Fatal(err)
	}
	entries := a.statusEntries()
	assertSessions(t, entries, b1)
	if entries[0].Repo != b.repo {
		t.Errorf("repo = %s, want %s", entries[0].Repo, b.repo)
	}
}

func TestStatusReportsFields(t *testing.T) {
	e := newEnv(t, "p")
	id := startCoder(t, e, "p") // session created at t0
	const adhocPrompt = "fix the login typo"
	if err := e.startPrompt(adhocPrompt); err != nil {
		t.Fatalf("start ad-hoc: %v", err)
	}
	idA := e.startEntry().Session
	name := app.AdhocName(adhocPrompt, t0)

	e.fake.Sessions[id].Title = "plan title"
	e.fake.Sessions[idA].Title = "adhoc title"
	writeTodo(t, e.worktree("p"), "p", todoWith(
		"- [x] **Task 1** - a", "- [x] **Task 2** - b", "- [-] **Task 3** - c",
		"- [ ] **Task 4** - d", "- [ ] **Task 5** - e"))

	t1 := t0.Add(60 * time.Second)  // latest prompt
	t2 := t0.Add(300 * time.Second) // now
	t3 := t0.Add(280 * time.Second) // went idle
	e.fake.Prompts[id] = []time.Time{t0, t1}
	e.clock.Set(t2)

	parse := func(s string) time.Time {
		t.Helper()
		got, err := time.Parse(time.RFC3339, s)
		if err != nil {
			t.Fatalf("%q is not an ISO 8601 time: %v", s, err)
		}
		return got
	}

	t.Run("running", func(t *testing.T) {
		if err := e.status(app.StatusOptions{SessionID: id}); err != nil {
			t.Fatal(err)
		}
		en := e.statusEntries()[0]
		if en.Tasks == nil || en.Tasks.Done != 2 || en.Tasks.Skipped != 1 || en.Tasks.Total != 5 {
			t.Errorf("tasks = %+v, want done 2 skipped 1 total 5", en.Tasks)
		}
		if en.State != "running" {
			t.Errorf("state = %q, want running", en.State)
		}
		if en.Outcome != nil {
			t.Errorf("outcome = %q, want null", *en.Outcome)
		}
		if !parse(en.StartedAt).Equal(t0) {
			t.Errorf("started_at = %s, want %s", en.StartedAt, t0)
		}
		if !parse(en.StateSince).Equal(t1) {
			t.Errorf("state_since = %s, want %s", en.StateSince, t1)
		}
		if en.RunningFor != 300 || en.InStateFor != 240 {
			t.Errorf("running_for/in_state_for = %d/%d, want 300/240", en.RunningFor, en.InStateFor)
		}
		if en.Plan == nil || *en.Plan != "p" || en.Repo != e.repo {
			t.Errorf("plan/repo = %v/%s, want p/%s", en.Plan, en.Repo, e.repo)
		}
	})

	t.Run("idle", func(t *testing.T) {
		delete(e.fake.Active, id)
		e.fake.Sessions[id].Idle = t3
		e.fake.Sessions[id].Outcome = "succeeded"

		if err := e.status(app.StatusOptions{SessionID: id}); err != nil {
			t.Fatal(err)
		}
		en := e.statusEntries()[0]
		if en.State != "idle" {
			t.Errorf("state = %q, want idle", en.State)
		}
		if en.Outcome == nil || *en.Outcome != "succeeded" {
			t.Errorf("outcome = %v, want succeeded", en.Outcome)
		}
		if !parse(en.StateSince).Equal(t3) {
			t.Errorf("state_since = %s, want %s", en.StateSince, t3)
		}
		if en.InStateFor != 20 {
			t.Errorf("in_state_for = %d, want 20", en.InStateFor)
		}
	})

	t.Run("both coders listed", func(t *testing.T) {
		if err := e.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		assertSessions(t, e.statusEntries(), id, idA)
	})

	t.Run("--all", func(t *testing.T) {
		if err := e.status(app.StatusOptions{All: true}); err != nil {
			t.Fatal(err)
		}
		assertSessions(t, e.statusEntries(), id, idA)
	})

	t.Run("scoped to the ad-hoc session", func(t *testing.T) {
		if err := e.status(app.StatusOptions{SessionID: idA}); err != nil {
			t.Fatal(err)
		}
		assertSessions(t, e.statusEntries(), idA)
	})

	t.Run("entry fields", func(t *testing.T) {
		if err := e.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		byID := map[string]entry{}
		for _, en := range e.statusEntries() {
			byID[en.Session] = en
		}
		p := byID[id]
		if p.Worktree != e.worktree("p") || p.Branch != "p" || p.Title != "plan title" || p.Plan == nil || *p.Plan != "p" {
			t.Errorf("plan entry = %+v", p)
		}
		a := byID[idA]
		if a.Plan != nil || a.Tasks != nil || a.Branch != name || a.Worktree != e.worktree(name) || a.Title != "adhoc title" {
			t.Errorf("ad-hoc entry = %+v", a)
		}
	})
}

var tableSplit = regexp.MustCompile(`\s{2,}`)

// tableCells splits one table line on runs of two or more spaces.
func tableCells(line string) []string {
	return tableSplit.Split(line, -1)
}

// tableLines splits the table stdout into lines.
func tableLines(s string) []string {
	return strings.Split(strings.TrimRight(s, "\n"), "\n")
}

func TestStatusHumanTable(t *testing.T) {
	e := newEnv(t, "p")
	id := startCoder(t, e, "p")
	const adhocPrompt = "fix the login typo"
	if err := e.startPrompt(adhocPrompt); err != nil {
		t.Fatalf("start ad-hoc: %v", err)
	}
	idA := e.startEntry().Session
	name := app.AdhocName(adhocPrompt, t0)
	writeTodo(t, e.worktree("p"), "p", todoWith(
		"- [x] **Task 1** - a", "- [x] **Task 2** - b", "- [-] **Task 3** - c",
		"- [ ] **Task 4** - d", "- [ ] **Task 5** - e"))

	e.fake.Sessions[id].Title = "plan title"
	e.fake.Sessions[idA].Title = "adhoc title"
	latest := t0.Add(60 * time.Second)  // plan coder's latest prompt
	idleAt := t0.Add(280 * time.Second) // ad-hoc coder went idle
	e.fake.Prompts[id] = []time.Time{t0, latest}
	delete(e.fake.Active, idA)
	e.fake.Sessions[idA].Idle = idleAt
	e.clock.Set(t0.Add(300 * time.Second))

	if err := e.statusWith("", app.StatusOptions{}); err != nil {
		t.Fatalf("status: %v", err)
	}
	want := [][]string{
		{"SESSION", "STATE", "TASKS", "BRANCH", "AGE", "IN STATE", "TITLE"},
		{idA, "idle", "-", name, "5m0s", "20s", "adhoc title"},
		{id, "running", "2/5", "p", "5m0s", "4m0s", "plan title"},
	}
	lines := tableLines(e.stdout.String())
	if len(lines) != len(want) {
		t.Fatalf("lines = %d, want %d\n%s", len(lines), len(want), e.stdout.String())
	}
	for i, w := range want {
		if got := tableCells(lines[i]); !reflect.DeepEqual(got, w) {
			t.Errorf("line %d = %v, want %v", i, got, w)
		}
	}

	// --all prepends the repo column.
	if err := e.statusWith("", app.StatusOptions{All: true}); err != nil {
		t.Fatalf("status --all: %v", err)
	}
	wantAll := [][]string{
		{"REPO", "SESSION", "STATE", "TASKS", "BRANCH", "AGE", "IN STATE", "TITLE"},
		{e.repo, idA, "idle", "-", name, "5m0s", "20s", "adhoc title"},
		{e.repo, id, "running", "2/5", "p", "5m0s", "4m0s", "plan title"},
	}
	lines = tableLines(e.stdout.String())
	if len(lines) != len(wantAll) {
		t.Fatalf("--all lines = %d, want %d\n%s", len(lines), len(wantAll), e.stdout.String())
	}
	for i, w := range wantAll {
		if got := tableCells(lines[i]); !reflect.DeepEqual(got, w) {
			t.Errorf("--all line %d = %v, want %v", i, got, w)
		}
	}

	// A repo with no coders prints the header only.
	empty := newEnv(t)
	if err := empty.statusWith("", app.StatusOptions{}); err != nil {
		t.Fatalf("status in an empty repo: %v", err)
	}
	lines = tableLines(empty.stdout.String())
	if len(lines) != 1 || !reflect.DeepEqual(tableCells(lines[0]), want[0]) {
		t.Errorf("empty repo = %q, want the header only", empty.stdout.String())
	}
}

func TestStatusIgnoresNonCoderSessions(t *testing.T) {
	e := newEnv(t, "p")
	id := startCoder(t, e, "p")
	e.fake.Sessions["ses_child"] = &client.Session{
		ID: "ses_child", ParentID: id, Directory: e.worktree("p"), Created: t0,
	}
	e.fake.Sessions["ses_main"] = &client.Session{
		ID: "ses_main", Directory: e.repo, Created: t0,
	}

	if err := e.status(app.StatusOptions{}); err != nil {
		t.Fatal(err)
	}
	assertSessions(t, e.statusEntries(), id)

	if err := e.status(app.StatusOptions{All: true}); err != nil {
		t.Fatal(err)
	}
	assertSessions(t, e.statusEntries(), id)
}

func TestStatusRejectsInvalidRequest(t *testing.T) {
	notRepo := t.TempDir()

	cases := []struct {
		name  string
		setup func(e *env) app.StatusOptions
		want  string
	}{
		{
			name:  "session not on the server",
			setup: func(*env) app.StatusOptions { return app.StatusOptions{SessionID: "ses_nope"} },
			want:  "session not found: ses_nope",
		},
		{
			name: "session is not a coder session",
			setup: func(e *env) app.StatusOptions {
				e.fake.Sessions["ses_main"] = &client.Session{ID: "ses_main", Directory: e.repo, Created: t0}
				return app.StatusOptions{SessionID: "ses_main"}
			},
			want: "not a coder session: ses_main",
		},
		{
			name:  "dir is not inside a git repo",
			setup: func(*env) app.StatusOptions { return app.StatusOptions{Dir: notRepo} },
			want:  "not a git repository: " + notRepo,
		},
		{
			name: "server unreachable",
			setup: func(e *env) app.StatusOptions {
				e.fake.Failures["*"] = client.ErrUnreachable
				return app.StatusOptions{}
			},
			want: "opencode server unreachable: " + serverURL,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			opts := tc.setup(e)

			err := e.status(opts)

			if err == nil {
				t.Fatal("status succeeded, want an error")
			}
			if err.Error() != tc.want {
				t.Errorf("error = %q, want %q", err.Error(), tc.want)
			}
			if e.stdout.Len() != 0 {
				t.Errorf("stdout = %q, want empty", e.stdout.String())
			}
		})
	}
}
