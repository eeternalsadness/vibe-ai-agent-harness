package app_test

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"boy/internal/app"
)

// startName is the fixed start time for the adhoc-name-format tests. Its
// nanoseconds pin the fractional part of the hash input's RFC 3339 form.
var startName = time.Date(2026, 10, 21, 10, 0, 0, 123456789, time.UTC)

// wantAdhocHash is the scenario's hash: the first 6 hex digits of
// sha256(prompt + "\n" + the start time as UTC RFC 3339 with nanoseconds).
func wantAdhocHash(prompt string, start time.Time) string {
	sum := sha256.Sum256([]byte(prompt + "\n" + start.UTC().Format(time.RFC3339Nano)))
	return hex.EncodeToString(sum[:])[:6]
}

func TestAdhocName(t *testing.T) {
	for _, tc := range []struct {
		name   string
		prompt string
		slug   string
	}{
		{name: "typo", prompt: "Fix the auth typo in login.go, please!", slug: "fix-the-auth-typo-in"},
		{name: "punctuation and case", prompt: "  --Update README  ", slug: "update-readme"},
		{name: "cut to 30 chars", prompt: "refactorize everything thoroughly immediately", slug: "refactorize-everything-thoroug"},
		{name: "empty slug", prompt: "日本語のみ", slug: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			want := "adhoc-" + wantAdhocHash(tc.prompt, startName)
			if tc.slug != "" {
				want = "adhoc-" + tc.slug + "-" + wantAdhocHash(tc.prompt, startName)
			}
			if got := app.AdhocName(tc.prompt, startName); got != want {
				t.Errorf("AdhocName(%q) = %q, want %q", tc.prompt, got, want)
			}
		})
	}

	t.Run("same prompt at two start times gives two names", func(t *testing.T) {
		a := app.AdhocName("same prompt", startName)
		b := app.AdhocName("same prompt", startName.Add(time.Minute))
		if a == b {
			t.Errorf("both times gave %q, want distinct names", a)
		}
	})
}
