package app_test

import (
	"path/filepath"
	"reflect"
	"testing"

	"boy/internal/app"
	"boy/internal/picker"
	"boy/internal/testutil"
)

func TestPickerStartsPlan(t *testing.T) {
	e := newEnv(t, "a-plan", "b-plan")
	testutil.WriteFile(e.t, filepath.Join(e.repo, ".agents", "plans", "archive", "old", "TODO.md"), "x")
	e.git("add", "-A")
	e.git("commit", "-q", "-m", "archive")
	e.picker = picker.NewFake()
	e.picker.ChooseScript = []int{0, 1} // "plan", then b-plan
	e.interactive = true
	before := e.gitState()

	if err := e.startOpts(app.StartOptions{}); err != nil {
		t.Fatalf("start: %v", err)
	}

	// The picker was first shown exactly plan and ad-hoc, then exactly the
	// active plans in order (the archived one is not listed).
	if len(e.picker.Shown) != 2 {
		t.Fatalf("picker was shown %d times, want 2: %+v", len(e.picker.Shown), e.picker.Shown)
	}
	if e.picker.Shown[0].Header != "start" || !reflect.DeepEqual(e.picker.Shown[0].Items, []string{"plan", "ad-hoc"}) {
		t.Errorf("first choice = %+v, want header start with items [plan ad-hoc]", e.picker.Shown[0])
	}
	if e.picker.Shown[1].Header != "plan" || !reflect.DeepEqual(e.picker.Shown[1].Items, []string{"a-plan", "b-plan"}) {
		t.Errorf("second choice = %+v, want header plan with items [a-plan b-plan]", e.picker.Shown[1])
	}

	// The outcome is the same as boy start --plan .agents/plans/b-plan.
	assertStarted(t, e, before, "b-plan")
}

func TestPickerStartsAdhoc(t *testing.T) {
	e := newEnv(t)
	const prompt = "Fix the login typo"
	e.picker = picker.NewFake()
	e.picker.ChooseScript = []int{1} // "ad-hoc"
	e.picker.ReadScript = []string{prompt}
	e.interactive = true
	before := e.gitState()

	if err := e.startOpts(app.StartOptions{}); err != nil {
		t.Fatalf("start: %v", err)
	}

	if len(e.picker.Shown) != 1 {
		t.Fatalf("picker was shown %d times, want 1: %+v", len(e.picker.Shown), e.picker.Shown)
	}
	if !reflect.DeepEqual(e.picker.Shown[0].Items, []string{"plan", "ad-hoc"}) {
		t.Errorf("choice items = %v, want [plan ad-hoc]", e.picker.Shown[0].Items)
	}
	if len(e.picker.Prompts) != 1 || e.picker.Prompts[0] != "prompt: " {
		t.Errorf("read prompts = %v, want [\"prompt: \"]", e.picker.Prompts)
	}

	// The outcome is the same as boy start "<prompt>".
	assertAdhocStarted(t, e, prompt, before)
}

func TestPickerRejects(t *testing.T) {
	cases := []struct {
		name  string
		plans bool // give the repo an active plan
		setup func(e *env)
		want  func(e *env) string
	}{
		{
			name: "cancelled at the first step",
			setup: func(e *env) {
				e.picker = picker.NewFake() // an empty script cancels
				e.interactive = true
			},
			want: func(*env) string { return "cancelled" },
		},
		{
			name: "cancelled at the second step",
			plans: true,
			setup: func(e *env) {
				e.picker = picker.NewFake()
				e.picker.ChooseScript = []int{0} // "plan", then the script is exhausted
				e.interactive = true
			},
			want: func(*env) string { return "cancelled" },
		},
		{
			name: "plan in a repo with no active plans",
			setup: func(e *env) {
				e.picker = picker.NewFake()
				e.picker.ChooseScript = []int{0}
				e.interactive = true
			},
			want: func(e *env) string { return "no active plans in " + e.repo },
		},
		{
			name: "ad-hoc with an empty line",
			setup: func(e *env) {
				e.picker = picker.NewFake()
				e.picker.ChooseScript = []int{1}
				e.picker.ReadScript = []string{""}
				e.interactive = true
			},
			want: func(*env) string { return "prompt required" },
		},
		{
			name: "ad-hoc with a blank line",
			setup: func(e *env) {
				e.picker = picker.NewFake()
				e.picker.ChooseScript = []int{1}
				e.picker.ReadScript = []string{"   "}
				e.interactive = true
			},
			want: func(*env) string { return "prompt required" },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var e *env
			if tc.plans {
				e = newEnv(t, "p")
			} else {
				e = newEnv(t)
			}
			tc.setup(e)
			before := e.gitState()

			err := e.startOpts(app.StartOptions{})

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
			if len(e.fake.Sessions) != 0 {
				t.Errorf("sessions = %d, want none", len(e.fake.Sessions))
			}
		})
	}
}
