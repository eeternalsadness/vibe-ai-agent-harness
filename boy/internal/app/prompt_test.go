package app_test

import (
	"testing"

	"boy/internal/client"
)

const promptText = "check the failing test on main"

func TestPromptIdleCoder(t *testing.T) {
	cases := []struct {
		name  string
		steer bool
		adHoc bool
	}{
		{name: "plan coder"},
		{name: "plan coder with steer", steer: true},
		{name: "ad-hoc coder", adHoc: true},
		{name: "ad-hoc coder with steer", adHoc: true, steer: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			var id string
			if tc.adHoc {
				if err := e.startPrompt("fix the build"); err != nil {
					t.Fatalf("start: %v", err)
				}
				id = e.startEntry().Session
			} else {
				id = startCoder(t, e, "p")
			}
			// The start prompt leaves the session marked running; make it idle.
			delete(e.fake.Active, id)
			// The command runs from a directory outside the repo.
			e.workDir = e.t.TempDir()
			// Starting the coder already sent its first prompt.
			before := len(e.fake.CallsTo("SendPrompt"))

			if err := e.prompt(id, promptText, tc.steer); err != nil {
				t.Fatalf("prompt: %v", err)
			}

			// The run makes the active list its first server call, then
			// fetches the session, then sends exactly one prompt.
			names := callNames(e.fake)
			idx := -1
			for i, n := range names {
				if n == "SendPrompt" {
					idx = i
				}
			}
			if idx < 2 || names[idx-2] != "ActiveSessionIDs" || names[idx-1] != "GetSession" {
				t.Fatalf("calls = %v, want ... ActiveSessionIDs, GetSession, SendPrompt", names)
			}
			calls := e.fake.CallsTo("SendPrompt")
			if len(calls) != before+1 {
				t.Fatalf("prompts sent = %d, want 1", len(calls)-before)
			}
			args := calls[before].Args
			if args["session"] != id {
				t.Errorf("prompt sent to %v, want %s", args["session"], id)
			}
			if text, _ := args["text"].(string); text != promptText {
				t.Errorf("prompt text = %q, want %q", text, promptText)
			}
			if d, has := args["delivery"]; has {
				t.Errorf("prompt delivery = %v, want none", d)
			}

			// The entry and the message.
			if en := e.startEntry(); en.Session != id {
				t.Errorf("entry session = %s, want %s", en.Session, id)
			}
			if want := "prompt sent to session " + id + "\n"; e.stderr.String() != want {
				t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
			}
		})
	}
}

func TestPromptRunningCoder(t *testing.T) {
	e := newEnv(t, "p")
	id := startCoder(t, e, "p") // sends the first prompt
	e.fake.Active[id] = true
	// The command runs from a directory outside the repo.
	e.workDir = e.t.TempDir()

	if err := e.prompt(id, "first follow-up", false); err != nil {
		t.Fatalf("prompt: %v", err)
	}
	if want := "prompt queued for session " + id + "\n"; e.stderr.String() != want {
		t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
	}
	e.stderr.Reset()

	if err := e.prompt(id, "second follow-up", true); err != nil {
		t.Fatalf("prompt --steer: %v", err)
	}
	if want := "prompt steered into session " + id + "\n"; e.stderr.String() != want {
		t.Errorf("stderr = %q, want %q", e.stderr.String(), want)
	}

	calls := e.fake.CallsTo("SendPrompt")
	if len(calls) != 3 { // the start prompt plus the two follow-ups
		t.Fatalf("prompts sent = %d, want 3", len(calls))
	}
	if d, _ := calls[1].Args["delivery"].(string); d != "queue" {
		t.Errorf("first delivery = %q, want queue", d)
	}
	if d, _ := calls[2].Args["delivery"].(string); d != "steer" {
		t.Errorf("second delivery = %q, want steer", d)
	}
	if got := len(e.fake.CallsTo("Interrupt")); got != 0 {
		t.Errorf("interrupts = %d, want none", got)
	}
}

func TestPromptRejectsInvalidRequest(t *testing.T) {
	cases := []struct {
		name string
		id   func(e *env) string
		text string
		// output is the requested format; "" means the test default, json.
		output string
		// noCalls requires that no client call at all was recorded.
		noCalls bool
		setup   func(e *env)
		want    func(e *env) string
	}{
		{
			name: "session not on the server",
			id:   func(*env) string { return "nope" },
			text: "do it",
			want: func(*env) string { return "session not found: nope" },
		},
		{
			name: "not a coder session",
			id:   func(*env) string { return "s_chat" },
			text: "do it",
			setup: func(e *env) {
				e.fake.Sessions["s_chat"] = &client.Session{ID: "s_chat", Directory: e.repo}
			},
			want: func(*env) string { return "not a coder session: s_chat" },
		},
		{
			name: "empty text",
			id:   func(e *env) string { return startCoder(t, e, "p") },
			text: "",
			want: func(*env) string { return "prompt required" },
		},
		{
			name: "blank text",
			id:   func(e *env) string { return startCoder(t, e, "p") },
			text: "   ",
			want: func(*env) string { return "prompt required" },
		},
		{
			name:    "unknown output format",
			id:      func(e *env) string { return startCoder(t, e, "p") },
			text:    "do it",
			output:  "yaml",
			noCalls: true,
			want:    func(*env) string { return "unknown output format: yaml" },
		},
		{
			name: "server unreachable",
			id:   func(e *env) string { return startCoder(t, e, "p") },
			text: "do it",
			setup: func(e *env) {
				e.fake.Failures["*"] = client.ErrUnreachable
			},
			want: func(*env) string { return "opencode server unreachable: " + serverURL },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := newEnv(t, "p")
			id := tc.id(e) // the coder must exist before the failure is armed
			if tc.setup != nil {
				tc.setup(e)
			}
			// startCoder itself sends the first prompt and makes calls.
			prompts, calls := len(e.fake.CallsTo("SendPrompt")), len(e.fake.Calls)

			err := e.promptWith(tc.output, id, tc.text, false)

			if err == nil {
				t.Fatal("prompt succeeded, want an error")
			}
			if want := tc.want(e); err.Error() != want {
				t.Errorf("error = %q, want %q", err.Error(), want)
			}
			if e.stdout.Len() != 0 {
				t.Errorf("stdout = %q, want empty", e.stdout.String())
			}
			if got := len(e.fake.CallsTo("SendPrompt")) - prompts; got != 0 {
				t.Errorf("prompts sent = %d, want none", got)
			}
			if tc.noCalls && len(e.fake.Calls) != calls {
				t.Errorf("client calls = %v, want none", callNames(e.fake)[calls:])
			}
		})
	}
}
