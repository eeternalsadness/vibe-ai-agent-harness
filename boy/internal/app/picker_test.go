package app_test

import (
	"path/filepath"
	"reflect"
	"testing"

	"boy/internal/picker"
	"boy/internal/testutil"
)

// archivedPlan commits a plan under .agents/plans/archive/, which the
// picker must not list.
func archivedPlan(e *env) {
	testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "archive", "old", "TODO.md"), "x")
	e.git("add", "-A")
	e.git("commit", "-q", "-m", "archive")
}

func TestPickerStartsPlan(t *testing.T) {
	e := newEnv(t, "a-plan", "b-plan")
	archivedPlan(e)
	e.interactive = true
	e.picker.Choices = []int{0, 1} // "plan", then "b-plan"
	before := e.gitState()

	if err := e.startPicker(); err != nil {
		t.Fatalf("start: %v", err)
	}

	var shown [][]string
	for _, s := range e.picker.Shown {
		shown = append(shown, s.Items)
	}
	want := [][]string{{"plan", "ad-hoc"}, {"a-plan", "b-plan"}}
	if !reflect.DeepEqual(shown, want) {
		t.Errorf("picker was shown %v, want %v", shown, want)
	}
	if len(e.picker.Prompts) != 0 {
		t.Errorf("picker read lines %v, want none", e.picker.Prompts)
	}
	assertPlanStarted(t, e, before, "b-plan")
}

func TestPickerStartsAdhoc(t *testing.T) {
	e := newEnv(t, "a-plan")
	e.interactive = true
	e.picker.Choices = []int{1} // "ad-hoc"
	e.picker.Lines = []string{adhocPrompt}
	before := e.gitState()
	name := wantAdhocName("fix-the-auth-typo-in", adhocPrompt, t0)

	if err := e.startPicker(); err != nil {
		t.Fatalf("start: %v", err)
	}

	if len(e.picker.Shown) != 1 || !reflect.DeepEqual(e.picker.Shown[0].Items, []string{"plan", "ad-hoc"}) {
		t.Errorf("picker was shown %v, want the plan/ad-hoc choice once", e.picker.Shown)
	}
	assertWorktree(t, e, before, name)
	en := assertLaunched(t, e, name, adhocPrompt, "ad-hoc "+name+" started at "+e.worktree(name))
	if en.Plan != nil || en.Tasks != nil {
		t.Errorf("stdout entry plan/tasks = %v/%v, want null/null", en.Plan, en.Tasks)
	}
}

func TestPickerRejects(t *testing.T) {
	cases := []struct {
		name  string
		plans []string
		setup func(f *picker.Fake)
		want  func(e *env) string
	}{
		{
			name:  "cancelled at the plan or ad-hoc step",
			plans: []string{"a-plan"},
			setup: func(f *picker.Fake) { f.Choices = []int{-1} },
			want:  func(*env) string { return "cancelled" },
		},
		{
			name:  "cancelled at the plan list",
			plans: []string{"a-plan"},
			setup: func(f *picker.Fake) { f.Choices = []int{0, -1} },
			want:  func(*env) string { return "cancelled" },
		},
		{
			name:  "cancelled at the prompt",
			plans: []string{"a-plan"},
			setup: func(f *picker.Fake) { f.Choices = []int{1} }, // no line to read
			want:  func(*env) string { return "cancelled" },
		},
		{
			name:  "plan chosen with no active plans",
			setup: func(f *picker.Fake) { f.Choices = []int{0} },
			want:  func(e *env) string { return "no active plans in " + e.repo },
		},
		{
			name:  "ad-hoc chosen with an empty line",
			plans: []string{"a-plan"},
			setup: func(f *picker.Fake) { f.Choices = []int{1}; f.Lines = []string{""} },
			want:  func(*env) string { return "prompt required" },
		},
		{
			name:  "ad-hoc chosen with a whitespace line",
			plans: []string{"a-plan"},
			setup: func(f *picker.Fake) { f.Choices = []int{1}; f.Lines = []string{"  \t "} },
			want:  func(*env) string { return "prompt required" },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, tc.plans...)
			archivedPlan(e) // an archived plan alone is still "no active plans"
			e.interactive = true
			tc.setup(e.picker)
			before := e.gitState()

			err := e.startPicker()

			if err == nil || err.Error() != tc.want(e) {
				t.Fatalf("error = %v, want %q", err, tc.want(e))
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
			if len(e.fake.Sessions) != 0 {
				t.Errorf("server has %d sessions, want none", len(e.fake.Sessions))
			}
		})
	}
}
