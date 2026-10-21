package app_test

import (
	"testing"

	"boy/internal/client"
)

func TestCoderNeverAsks(t *testing.T) {
	e := newEnv(t, "p")
	startCoder(t, e, "p")

	calls := e.fake.CallsTo("CreateSession")
	if len(calls) != 1 {
		t.Fatalf("CreateSession calls = %d, want 1", len(calls))
	}
	rules := calls[0].Args["request"].(client.CreateSessionRequest).Permissions
	if len(rules) == 0 {
		t.Fatal("session was created with no permission rules")
	}

	for _, r := range rules {
		if r.Effect != "allow" && r.Effect != "deny" {
			t.Errorf("rule %+v has effect %q, want allow or deny", r, r.Effect)
		}
	}

	if first := rules[0]; first.Action != "*" || first.Resource != "*" {
		t.Errorf("first rule = %+v, want a catch-all", first)
	}

	// The last matching rule wins, so find the last rule that covers "question".
	var verdict string
	for _, r := range rules {
		if r.Action == "*" || r.Action == "question" {
			verdict = r.Effect
		}
	}
	if verdict != "deny" {
		t.Errorf("question is %q, want deny", verdict)
	}
}
