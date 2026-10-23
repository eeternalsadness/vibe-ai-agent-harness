package app_test

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"boy/internal/app"
)

// wantAdhocName computes the name from ACCEPTANCE.md's Coder Names, apart
// from the slug, which each case spells out.
func wantAdhocName(slug, prompt string, start time.Time) string {
	sum := sha256.Sum256([]byte(prompt + "\n" + start.UTC().Format(time.RFC3339Nano)))
	hash := hex.EncodeToString(sum[:])[:6]
	if slug == "" {
		return "adhoc-" + hash
	}
	return "adhoc-" + slug + "-" + hash
}

func TestAdhocNameFormat(t *testing.T) {
	start := time.Date(2026, 10, 21, 10, 0, 0, 123456789, time.UTC)

	cases := []struct {
		prompt string
		slug   string
	}{
		{"Fix the auth typo in login.go, please!", "fix-the-auth-typo-in"},
		{"  --Update README  ", "update-readme"},
		{"refactorize everything thoroughly immediately", "refactorize-everything-thoroug"},
		{"日本語のみ", ""},
		// The cut to 30 characters can land after a hyphen, which is trimmed.
		{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaa b", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
	}
	for _, tc := range cases {
		t.Run(tc.prompt, func(t *testing.T) {
			got := app.AdhocName(tc.prompt, start)
			if want := wantAdhocName(tc.slug, tc.prompt, start); got != want {
				t.Errorf("AdhocName = %q, want %q", got, want)
			}
		})
	}

	t.Run("the hash uses UTC whatever the zone of the start time", func(t *testing.T) {
		zone := time.FixedZone("UTC+8", 8*3600)
		got := app.AdhocName("same prompt", start.In(zone))
		if want := wantAdhocName("same-prompt", "same prompt", start); got != want {
			t.Errorf("AdhocName = %q, want %q", got, want)
		}
	})

	t.Run("the same prompt at two start times gives two names", func(t *testing.T) {
		a := app.AdhocName("same prompt", start)
		b := app.AdhocName("same prompt", start.Add(time.Nanosecond))
		if a == b {
			t.Errorf("both start times gave %q", a)
		}
	})
}
