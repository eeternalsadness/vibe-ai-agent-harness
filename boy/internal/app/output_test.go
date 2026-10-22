package app_test

import (
	"encoding/json"
	"testing"

	"boy/internal/app"
)

// TestOutputFormatFlag runs every command with Output "", json and yaml.
// The --output long form itself is checked in main_test.go.
func TestOutputFormatFlag(t *testing.T) {
	t.Run("start", func(t *testing.T) {
		e := newEnv(t, "p")

		before := len(e.fake.Calls)
		err := e.startWith("yaml", app.StartOptions{Plan: ".agents/plans/p"})
		if err == nil || err.Error() != "unknown output format: yaml" {
			t.Errorf("yaml: error = %v, want unknown output format: yaml", err)
		}
		if got := len(e.fake.Calls); got != before {
			t.Errorf("yaml: client calls = %v, want none", callNames(e.fake)[before:])
		}

		if err := e.startWith("", app.StartOptions{Plan: ".agents/plans/p"}); err != nil {
			t.Fatalf("no flag: %v", err)
		}
		assertNotJSON(t, e.stdout.String())

		if err := e.startWith("json", app.StartOptions{Plan: ".agents/plans/p"}); err != nil {
			t.Fatalf("json: %v", err)
		}
		assertJSON(t, e.stdout.String(), "object")
	})

	t.Run("status", func(t *testing.T) {
		e := newEnv(t, "p")
		startCoder(t, e, "p")

		before := len(e.fake.Calls)
		err := e.statusWith("yaml", app.StatusOptions{})
		if err == nil || err.Error() != "unknown output format: yaml" {
			t.Errorf("yaml: error = %v, want unknown output format: yaml", err)
		}
		if got := len(e.fake.Calls); got != before {
			t.Errorf("yaml: client calls = %v, want none", callNames(e.fake)[before:])
		}

		if err := e.statusWith("", app.StatusOptions{}); err != nil {
			t.Fatalf("no flag: %v", err)
		}
		assertNotJSON(t, e.stdout.String())

		if err := e.statusWith("json", app.StatusOptions{}); err != nil {
			t.Fatalf("json: %v", err)
		}
		assertJSON(t, e.stdout.String(), "array")
	})

	t.Run("prompt", func(t *testing.T) {
		e := newEnv(t, "p")
		id := startCoder(t, e, "p")

		before := len(e.fake.Calls)
		err := e.promptWith("yaml", id, "do it", false)
		if err == nil || err.Error() != "unknown output format: yaml" {
			t.Errorf("yaml: error = %v, want unknown output format: yaml", err)
		}
		if got := len(e.fake.Calls); got != before {
			t.Errorf("yaml: client calls = %v, want none", callNames(e.fake)[before:])
		}

		if err := e.promptWith("", id, promptText, false); err != nil {
			t.Fatalf("no flag: %v", err)
		}
		assertNotJSON(t, e.stdout.String())

		if err := e.promptWith("json", id, promptText, false); err != nil {
			t.Fatalf("json: %v", err)
		}
		assertJSON(t, e.stdout.String(), "object")
	})
}

// assertNotJSON fails if s parses as a JSON object.
func assertNotJSON(t *testing.T, s string) {
	t.Helper()
	if err := json.Unmarshal([]byte(s), &map[string]any{}); err == nil {
		t.Errorf("stdout parsed as JSON:\n%s", s)
	}
}

// assertJSON fails if s does not parse as the given JSON kind, "object" or
// "array".
func assertJSON(t *testing.T, s, kind string) {
	t.Helper()
	var err error
	switch kind {
	case "array":
		err = json.Unmarshal([]byte(s), &[]map[string]any{})
	case "object":
		err = json.Unmarshal([]byte(s), &map[string]any{})
	}
	if err != nil {
		t.Errorf("stdout is not %s JSON: %v\n%s", kind, err, s)
	}
}
