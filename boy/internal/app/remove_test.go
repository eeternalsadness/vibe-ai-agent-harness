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

// makeIdle moves a started coder from running to idle.
func makeIdle(e *env, id string) {
	delete(e.fake.Active, id)
	e.fake.Sessions[id].Idle = t0
	e.fake.Sessions[id].Outcome = "succeeded"
}

// commitInWorktree adds a commit to the plan branch from its worktree.
func commitInWorktree(t *testing.T, e *env, plan string) {
	t.Helper()
	wt := e.worktree(plan)
	testutil.WriteFile(t, filepath.Join(wt, "work.txt"), "work\n")
	testutil.Git(t, wt, "add", "work.txt")
	testutil.Git(t, wt, "commit", "-q", "-m", "work")
}

// removalCalls lists the calls remove must order: interrupt, then worktree
// removal, then session delete.
func removalCalls(f *client.Fake) []string {
	var out []string
	for _, n := range callNames(f) {
		switch n {
		case "Interrupt", "RemoveWorktree", "DeleteSession":
			out = append(out, n)
		}
	}
	return out
}

func assertRemoved(t *testing.T, e *env, plan, id string, wantCalls []string, force bool) {
	t.Helper()
	wt := e.worktree(plan)
	if _, err := os.Stat(wt); !os.IsNotExist(err) {
		t.Errorf("worktree %s still exists (err %v)", wt, err)
	}
	if strings.Contains(e.git("worktree", "list", "--porcelain"), wt) {
		t.Errorf("git worktree list still shows %s", wt)
	}
	e.git("rev-parse", "--verify", "refs/heads/"+plan) // branch kept; fails the test if gone
	if _, ok := e.fake.Sessions[id]; ok {
		t.Errorf("session %s still on the server", id)
	}
	if got := removalCalls(e.fake); !reflect.DeepEqual(got, wantCalls) {
		t.Errorf("calls = %v, want %v", got, wantCalls)
	}
	rm := e.fake.CallsTo("RemoveWorktree")
	if len(rm) != 1 || rm[0].Args["directory"] != wt || rm[0].Args["force"] != force {
		t.Errorf("RemoveWorktree calls = %+v, want one for %s with force=%v", rm, wt, force)
	}
	if want := "removed session " + id + " at " + wt + "\n"; e.stdout.String() != want {
		t.Errorf("stdout = %q, want %q", e.stdout.String(), want)
	}
}

func TestRemoveMergedCoder(t *testing.T) {
	e := newEnv(t, "p")
	id := startCoder(t, e, "p")
	makeIdle(e, id)
	commitInWorktree(t, e, "p")
	e.git("merge", "-q", "--ff-only", "p")
	e.workDir = t.TempDir() // from any directory
	e.fake.Calls = nil

	if err := e.remove(id, false); err != nil {
		t.Fatalf("remove: %v", err)
	}
	assertRemoved(t, e, "p", id, []string{"RemoveWorktree", "DeleteSession"}, false)
}

// unsafeStates are the coder states remove refuses without --force.
type unsafeState struct {
	name string
	// setup puts a freshly started coder into the state and returns the
	// error remove should report without --force.
	setup func(t *testing.T, e *env, id string) string
	// interrupts is whether --force must interrupt the coder first.
	interrupts bool
}

func unsafeStates() []unsafeState {
	return []unsafeState{
		{
			name:       "coder is running",
			setup:      func(_ *testing.T, _ *env, id string) string { return "coder is still running: " + id },
			interrupts: true,
		},
		{
			name: "branch not merged",
			setup: func(t *testing.T, e *env, id string) string {
				makeIdle(e, id)
				commitInWorktree(t, e, "p")
				return "branch not merged: p"
			},
		},
		{
			name: "worktree has uncommitted changes",
			setup: func(t *testing.T, e *env, id string) string {
				makeIdle(e, id)
				testutil.WriteFile(t, filepath.Join(e.worktree("p"), "scratch.txt"), "wip\n")
				return "worktree has uncommitted changes: " + e.worktree("p")
			},
		},
	}
}

func TestRemoveRefusesUnsafe(t *testing.T) {
	for _, st := range unsafeStates() {
		t.Run(st.name, func(t *testing.T) {
			e := newEnv(t, "p")
			id := startCoder(t, e, "p")
			want := st.setup(t, e, id)
			e.fake.Calls = nil

			err := e.remove(id, false)

			if err == nil || err.Error() != want {
				t.Fatalf("error = %v, want %q", err, want)
			}
			if e.stdout.Len() != 0 {
				t.Errorf("stdout = %q, want empty", e.stdout.String())
			}
			mustExist(t, filepath.Join(e.worktree("p"), ".agents", "plans", "p", "TODO.md"))
			if _, ok := e.fake.Sessions[id]; !ok {
				t.Error("session was deleted")
			}
			if got := removalCalls(e.fake); len(got) != 0 {
				t.Errorf("calls = %v, want none", got)
			}
		})
	}

	t.Run("session not on the server", func(t *testing.T) {
		e := newEnv(t, "p")
		err := e.remove("ses_nope", false)
		if err == nil || err.Error() != "session not found: ses_nope" {
			t.Fatalf("error = %v", err)
		}
	})

	t.Run("session is not a coder session", func(t *testing.T) {
		e := newEnv(t, "p")
		e.fake.Sessions["ses_main"] = &client.Session{ID: "ses_main", Directory: e.repo, Created: t0}
		err := e.remove("ses_main", false)
		if err == nil || err.Error() != "not a coder session: ses_main" {
			t.Fatalf("error = %v", err)
		}
		if got := removalCalls(e.fake); len(got) != 0 {
			t.Errorf("calls = %v, want none", got)
		}
	})
}

func TestRemoveForce(t *testing.T) {
	for _, st := range unsafeStates() {
		t.Run(st.name, func(t *testing.T) {
			e := newEnv(t, "p")
			id := startCoder(t, e, "p")
			st.setup(t, e, id)
			e.fake.Calls = nil

			if err := e.remove(id, true); err != nil {
				t.Fatalf("remove --force: %v", err)
			}

			wantCalls := []string{"RemoveWorktree", "DeleteSession"}
			if st.interrupts {
				wantCalls = []string{"Interrupt", "RemoveWorktree", "DeleteSession"}
			}
			assertRemoved(t, e, "p", id, wantCalls, true)
		})
	}
}
