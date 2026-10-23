package app_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"boy/internal/app"
)

var tableHeader = []string{"SESSION", "STATE", "TASKS", "BRANCH", "AGE", "IN STATE", "TITLE"}

func isJSON(s string) bool { return json.Valid([]byte(s)) }

// outputCommands maps each command that takes -o to a function running it.
func outputCommands(t *testing.T) map[string]func(e *env) error {
	t.Helper()
	return map[string]func(e *env) error{
		"start --plan": func(e *env) error { return e.startPlan("p") },
		"start prompt": func(e *env) error { return e.startAdhoc("do it") },
		"status":       func(e *env) error { return e.status(app.StatusOptions{}) },
		"prompt": func(e *env) error {
			id := e.fake.Sessions[firstSession(e)].ID
			return e.prompt(id, "more", false)
		},
	}
}

func firstSession(e *env) string {
	for id := range e.fake.Sessions {
		return id
	}
	return ""
}

func TestOutputFormatFlag(t *testing.T) {
	for name, run := range outputCommands(t) {
		// status and prompt need a coder to report on.
		prepare := func(t *testing.T, e *env) {
			if name == "status" || name == "prompt" {
				startCoder(t, e, "p")
				e.fake.Calls = nil
			}
		}

		t.Run(name+" prints a table by default", func(t *testing.T) {
			e := newEnv(t, "p")
			prepare(t, e)
			e.output = ""
			if err := run(e); err != nil {
				t.Fatal(err)
			}
			if isJSON(e.stdout.String()) {
				t.Errorf("stdout is JSON, want a table:\n%s", e.stdout.String())
			}
			rows := tableRows(t, e)
			if len(rows) != 2 || !reflect.DeepEqual(rows[0], tableHeader) {
				t.Errorf("table = %q, want the header and one row", rows)
			}
		})

		t.Run(name+" prints JSON with -o json", func(t *testing.T) {
			e := newEnv(t, "p")
			prepare(t, e)
			e.output = "json"
			if err := run(e); err != nil {
				t.Fatal(err)
			}
			if !isJSON(e.stdout.String()) {
				t.Errorf("stdout is not JSON:\n%s", e.stdout.String())
			}
		})

		t.Run(name+" rejects an unknown format and does nothing", func(t *testing.T) {
			e := newEnv(t, "p")
			prepare(t, e)
			e.output = "yaml"
			before := e.gitState()
			e.fake.Calls = nil

			err := run(e)

			if err == nil || err.Error() != "unknown output format: yaml" {
				t.Fatalf("error = %v, want %q", err, "unknown output format: yaml")
			}
			if e.stdout.Len() != 0 {
				t.Errorf("stdout = %q, want empty", e.stdout.String())
			}
			if got := e.gitState(); got != before {
				t.Errorf("repo changed: before %+v, after %+v", before, got)
			}
			if len(e.fake.Calls) != 0 {
				t.Errorf("client calls = %v, want none", callNames(e.fake))
			}
		})
	}

	t.Run("start with no arguments rejects an unknown format before asking", func(t *testing.T) {
		e := newEnv(t, "p")
		e.interactive = true
		e.output = "yaml"

		err := e.startPicker()

		if err == nil || err.Error() != "unknown output format: yaml" {
			t.Fatalf("error = %v", err)
		}
		if len(e.picker.Shown) != 0 {
			t.Errorf("picker was shown %v, want nothing", e.picker.Shown)
		}
	})
}
