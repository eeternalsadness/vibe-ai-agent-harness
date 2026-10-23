package app_test

import (
	"testing"

	"boy/internal/client"
)

// startedCoders starts a plan coder and an ad-hoc coder, runs later commands
// from outside the repo, and returns both session ids.
func startedCoders(t *testing.T) (e *env, planID, adhocID string) {
	t.Helper()
	e = newEnv(t, "p")
	planID = startCoder(t, e, "p")
	if err := e.startAdhoc("do a small thing"); err != nil {
		t.Fatalf("start ad-hoc: %v", err)
	}
	adhocID = e.startEntry().Session
	e.workDir = t.TempDir()
	e.fake.Calls = nil
	return e, planID, adhocID
}

func lastPrompt(t *testing.T, e *env) map[string]any {
	t.Helper()
	calls := e.fake.CallsTo("SendPrompt")
	if len(calls) != 1 {
		t.Fatalf("SendPrompt calls = %d, want 1", len(calls))
	}
	return calls[0].Args
}

func TestPromptIdleCoder(t *testing.T) {
	for _, steer := range []bool{false, true} {
		name := "without --steer"
		if steer {
			name = "with --steer"
		}
		t.Run(name, func(t *testing.T) {
			e, planID, adhocID := startedCoders(t)
			for _, id := range []string{planID, adhocID} {
				makeIdle(e, id)
				e.fake.Calls = nil

				if err := e.prompt(id, "also fix the docs", steer); err != nil {
					t.Fatalf("prompt %s: %v", id, err)
				}

				args := lastPrompt(t, e)
				if args["session"] != id || args["text"] != "also fix the docs" || args["delivery"] != "" {
					t.Errorf("prompt call = %v, want text only to %s", args, id)
				}
				if got := e.startEntry().Session; got != id {
					t.Errorf("stdout entry session = %s, want %s", got, id)
				}
				if want := "prompt sent to session " + id + "\n"; e.stderr.String() != want {
					t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
				}
				if got := e.fake.CallsTo("Interrupt"); len(got) != 0 {
					t.Errorf("Interrupt calls = %v, want none", got)
				}
			}
		})
	}
}

func TestPromptRunningCoder(t *testing.T) {
	e, planID, adhocID := startedCoders(t)
	for _, id := range []string{planID, adhocID} {
		for _, tc := range []struct {
			steer             bool
			delivery, message string
		}{
			{false, client.DeliveryQueue, "prompt queued for session " + id},
			{true, client.DeliverySteer, "prompt steered into session " + id},
		} {
			e.fake.Active[id] = true // running
			e.fake.Calls = nil

			if err := e.prompt(id, "use a table", tc.steer); err != nil {
				t.Fatalf("prompt %s: %v", id, err)
			}

			args := lastPrompt(t, e)
			if args["session"] != id || args["text"] != "use a table" || args["delivery"] != tc.delivery {
				t.Errorf("prompt call = %v, want delivery %q to %s", args, tc.delivery, id)
			}
			if e.stderr.String() != tc.message+"\n" {
				t.Errorf("stderr = %q, want %q", e.stderr.String(), tc.message+"\n")
			}
			if got := e.startEntry().Session; got != id {
				t.Errorf("stdout entry session = %s, want %s", got, id)
			}
			if got := e.fake.CallsTo("Interrupt"); len(got) != 0 {
				t.Errorf("Interrupt calls = %v, want none", got)
			}
		}
	}
}

func TestPromptRejectsInvalidRequest(t *testing.T) {
	cases := []struct {
		name  string
		setup func(e *env)
		id    func(planID string) string
		text  string
		want  func(id string) string
	}{
		{
			name: "session not on the server",
			id:   func(string) string { return "ses_nope" },
			text: "x",
			want: func(string) string { return "session not found: ses_nope" },
		},
		{
			name: "session is not a coder session",
			setup: func(e *env) {
				e.fake.Sessions["ses_main"] = &client.Session{ID: "ses_main", Directory: e.repo, Created: t0}
			},
			id:   func(string) string { return "ses_main" },
			text: "x",
			want: func(string) string { return "not a coder session: ses_main" },
		},
		{
			name: "empty text",
			id:   func(p string) string { return p },
			text: "",
			want: func(string) string { return "prompt required" },
		},
		{
			name: "whitespace text",
			id:   func(p string) string { return p },
			text: " \t\n",
			want: func(string) string { return "prompt required" },
		},
		{
			name:  "server unreachable",
			setup: func(e *env) { e.fake.Failures["*"] = client.ErrUnreachable },
			id:    func(p string) string { return p },
			text:  "x",
			want:  func(string) string { return "opencode server unreachable: " + serverURL },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e, planID, _ := startedCoders(t)
			if tc.setup != nil {
				tc.setup(e)
			}
			e.fake.Calls = nil

			err := e.prompt(tc.id(planID), tc.text, false)

			if want := tc.want(planID); err == nil || err.Error() != want {
				t.Fatalf("error = %v, want %q", err, want)
			}
			if e.stdout.Len() != 0 {
				t.Errorf("stdout = %q, want empty", e.stdout.String())
			}
			if got := e.fake.CallsTo("SendPrompt"); len(got) != 0 {
				t.Errorf("SendPrompt calls = %v, want none", got)
			}
		})
	}
}
