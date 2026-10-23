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
	if err := e.startPlan(plan); err != nil {
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

// coders is what twoCoders sets up.
type coders struct {
	e         *env
	planID    string
	adhocID   string
	adhocName string
}

const (
	planTitle  = "Implement plan p"
	adhocTitle = "Fix the typo"
)

// twoCoders starts a plan coder p and an ad-hoc coder in one repo and gives
// them fixed titles, states and times. The clock ends at t0+300s.
//
//	plan p:  created t0,     running, latest prompt t0+60s, 2 of 5 tasks done, 1 skipped
//	ad-hoc:  created t0+10s, idle since t0+100s, outcome "succeeded"
func twoCoders(t *testing.T) coders {
	t.Helper()
	e := newEnv(t, "p")
	planID := startCoder(t, e, "p")
	e.clock.Advance(10 * time.Second)
	if err := e.startAdhoc(adhocPrompt); err != nil {
		t.Fatalf("start ad-hoc: %v", err)
	}
	adhocID := e.startEntry().Session
	adhocName := wantAdhocName("fix-the-auth-typo-in", adhocPrompt, t0.Add(10*time.Second))

	writeTodo(t, e.worktree("p"), "p", todoWith(
		"- [x] **Task 1** - a", "- [x] **Task 2** - b", "- [-] **Task 3** - c",
		"- [ ] **Task 4** - d", "- [ ] **Task 5** - e"))
	e.fake.Sessions[planID].Title = planTitle
	e.fake.Prompts[planID] = []time.Time{t0, t0.Add(60 * time.Second)}

	e.fake.Sessions[adhocID].Title = adhocTitle
	delete(e.fake.Active, adhocID)
	e.fake.Sessions[adhocID].Idle = t0.Add(100 * time.Second)
	e.fake.Sessions[adhocID].Outcome = "succeeded"

	e.clock.Set(t0.Add(300 * time.Second))
	return coders{e: e, planID: planID, adhocID: adhocID, adhocName: adhocName}
}

func TestStatusReportsFields(t *testing.T) {
	c := twoCoders(t)
	e := c.e
	rfc := func(d time.Duration) string { return t0.Add(d).UTC().Format(time.RFC3339) }

	if err := e.status(app.StatusOptions{All: true}); err != nil {
		t.Fatal(err)
	}
	entries := e.statusEntries()
	if len(entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(entries))
	}

	// Sorted by repo, then branch: "adhoc-..." sorts before "p".
	adhoc, plan := entries[0], entries[1]

	if plan.Session != c.planID || plan.Repo != e.repo || plan.Worktree != e.worktree("p") ||
		plan.Title != planTitle || plan.Plan == nil || *plan.Plan != "p" || plan.Branch != "p" {
		t.Errorf("plan entry identity = %+v", plan)
	}
	if plan.Tasks == nil || plan.Tasks.Done != 2 || plan.Tasks.Skipped != 1 || plan.Tasks.Total != 5 {
		t.Errorf("plan tasks = %+v, want done 2 skipped 1 total 5", plan.Tasks)
	}
	if plan.State != "running" || plan.Outcome != nil {
		t.Errorf("plan state/outcome = %s/%v, want running/null", plan.State, plan.Outcome)
	}
	if plan.StartedAt != rfc(0) || plan.StateSince != rfc(60*time.Second) {
		t.Errorf("plan started_at/state_since = %s/%s, want %s/%s", plan.StartedAt, plan.StateSince, rfc(0), rfc(60*time.Second))
	}
	if plan.RunningFor != 300 || plan.InStateFor != 240 {
		t.Errorf("plan running_for/in_state_for = %d/%d, want 300/240", plan.RunningFor, plan.InStateFor)
	}

	if adhoc.Session != c.adhocID || adhoc.Repo != e.repo || adhoc.Worktree != e.worktree(c.adhocName) ||
		adhoc.Title != adhocTitle || adhoc.Branch != c.adhocName {
		t.Errorf("ad-hoc entry identity = %+v", adhoc)
	}
	if adhoc.Plan != nil || adhoc.Tasks != nil {
		t.Errorf("ad-hoc plan/tasks = %v/%v, want null/null", adhoc.Plan, adhoc.Tasks)
	}
	if adhoc.State != "idle" || adhoc.Outcome == nil || *adhoc.Outcome != "succeeded" {
		t.Errorf("ad-hoc state/outcome = %s/%v, want idle/succeeded", adhoc.State, adhoc.Outcome)
	}
	if adhoc.StartedAt != rfc(10*time.Second) || adhoc.StateSince != rfc(100*time.Second) {
		t.Errorf("ad-hoc started_at/state_since = %s/%s", adhoc.StartedAt, adhoc.StateSince)
	}
	if adhoc.RunningFor != 290 || adhoc.InStateFor != 200 {
		t.Errorf("ad-hoc running_for/in_state_for = %d/%d, want 290/200", adhoc.RunningFor, adhoc.InStateFor)
	}

	t.Run("the repo and each session list the coders too", func(t *testing.T) {
		if err := e.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		assertSessions(t, e.statusEntries(), c.planID, c.adhocID)

		for _, id := range []string{c.planID, c.adhocID} {
			if err := e.status(app.StatusOptions{SessionID: id}); err != nil {
				t.Fatal(err)
			}
			assertSessions(t, e.statusEntries(), id)
		}
	})

	t.Run("a plan coder that went idle reports its outcome", func(t *testing.T) {
		delete(e.fake.Active, c.planID)
		e.fake.Sessions[c.planID].Idle = t0.Add(280 * time.Second)
		e.fake.Sessions[c.planID].Outcome = "succeeded"

		if err := e.status(app.StatusOptions{SessionID: c.planID}); err != nil {
			t.Fatal(err)
		}
		en := e.statusEntries()[0]
		if en.State != "idle" || en.Outcome == nil || *en.Outcome != "succeeded" ||
			en.StateSince != rfc(280*time.Second) || en.InStateFor != 20 {
			t.Errorf("entry = %+v, want idle since +280s, 20s in state, outcome succeeded", en)
		}
	})
}

// splitRow splits one table line into cells on runs of two or more spaces.
var cellGap = regexp.MustCompile(` {2,}`)

func splitRow(line string) []string { return cellGap.Split(strings.TrimRight(line, " "), -1) }

func tableRows(t *testing.T, e *env) [][]string {
	t.Helper()
	text := e.stdout.String()
	if !strings.HasSuffix(text, "\n") {
		t.Fatalf("table does not end with a newline: %q", text)
	}
	var rows [][]string
	for _, line := range strings.Split(strings.TrimSuffix(text, "\n"), "\n") {
		rows = append(rows, splitRow(line))
	}
	return rows
}

func TestStatusHumanTable(t *testing.T) {
	c := twoCoders(t)
	e := c.e
	e.output = ""

	adhocRow := []string{c.adhocID, "idle", "-", c.adhocName, "4m50s", "3m20s", adhocTitle}
	planRow := []string{c.planID, "running", "2/5", "p", "5m0s", "4m0s", planTitle}
	header := []string{"SESSION", "STATE", "TASKS", "BRANCH", "AGE", "IN STATE", "TITLE"}

	t.Run("without --all", func(t *testing.T) {
		if err := e.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		if got, want := tableRows(t, e), [][]string{header, adhocRow, planRow}; !reflect.DeepEqual(got, want) {
			t.Errorf("table = %q, want %q", got, want)
		}
	})

	t.Run("--all adds REPO first", func(t *testing.T) {
		if err := e.status(app.StatusOptions{All: true}); err != nil {
			t.Fatal(err)
		}
		withRepo := func(first string, row []string) []string { return append([]string{first}, row...) }
		want := [][]string{withRepo("REPO", header), withRepo(e.repo, adhocRow), withRepo(e.repo, planRow)}
		if got := tableRows(t, e); !reflect.DeepEqual(got, want) {
			t.Errorf("table = %q, want %q", got, want)
		}
	})

	t.Run("columns are aligned", func(t *testing.T) {
		if err := e.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		lines := strings.Split(strings.TrimSuffix(e.stdout.String(), "\n"), "\n")
		col := strings.Index(lines[0], "STATE")
		for _, line := range lines[1:] {
			if col >= len(line) || line[col-1] != ' ' || line[col] == ' ' {
				t.Errorf("STATE column is not aligned at %d in %q", col, line)
			}
		}
	})

	t.Run("a repo with no coders prints only the header", func(t *testing.T) {
		empty := e.otherRepo()
		empty.output = ""
		if err := empty.status(app.StatusOptions{}); err != nil {
			t.Fatal(err)
		}
		if got, want := tableRows(t, empty), [][]string{header}; !reflect.DeepEqual(got, want) {
			t.Errorf("table = %q, want %q", got, want)
		}
	})
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
