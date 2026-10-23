package app

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
	"time"
)

const (
	adhocPrefix   = "adhoc-"
	slugWords     = 5
	slugMaxLength = 30
)

var nonSlugRun = regexp.MustCompile(`[^a-z0-9]+`)

// AdhocName is the name, worktree directory and branch of the ad-hoc coder
// started for prompt at start: "adhoc-<slug>-<hash>", or "adhoc-<hash>" when
// the prompt has no letters or digits to make a slug from.
func AdhocName(prompt string, start time.Time) string {
	sum := sha256.Sum256([]byte(prompt + "\n" + start.UTC().Format(time.RFC3339Nano)))
	hash := hex.EncodeToString(sum[:])[:6]
	if slug := promptSlug(prompt); slug != "" {
		return adhocPrefix + slug + "-" + hash
	}
	return adhocPrefix + hash
}

// promptSlug lowercases the prompt, keeps its first few words as [a-z0-9]
// words joined by "-", and cuts the result to a branch-friendly length.
func promptSlug(prompt string) string {
	slug := strings.Trim(nonSlugRun.ReplaceAllString(strings.ToLower(prompt), "-"), "-")
	words := strings.Split(slug, "-")
	if len(words) > slugWords {
		words = words[:slugWords]
	}
	slug = strings.Join(words, "-")
	// The slug is ASCII by now, so cutting by bytes cannot split a character.
	if len(slug) > slugMaxLength {
		slug = slug[:slugMaxLength]
	}
	return strings.TrimRight(slug, "-")
}

// isAdhoc reports whether a coder name belongs to an ad-hoc coder.
func isAdhoc(name string) bool { return strings.HasPrefix(name, adhocPrefix) }
