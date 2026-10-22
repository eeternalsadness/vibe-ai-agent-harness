package app

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
	"time"
)

// adhocPrefix marks a coder's name as an ad-hoc run. A coder's name is its
// worktree directory name and branch name, so the prefix alone tells a coder's
// kind without boy storing anything.
const adhocPrefix = "adhoc-"

// IsAdhocName reports whether name marks an ad-hoc coder.
func IsAdhocName(name string) bool {
	return strings.HasPrefix(name, adhocPrefix)
}

// AdhocName builds an ad-hoc coder's name from the prompt and start time:
// adhoc-<slug>-<hash>, or adhoc-<hash> when the slug is empty.
func AdhocName(prompt string, start time.Time) string {
	slug := adhocSlug(prompt)
	hash := adhocHash(prompt, start)
	if slug == "" {
		return adhocPrefix + hash
	}
	return adhocPrefix + slug + "-" + hash
}

// nonSlug is a run of characters that never appears in a slug.
var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// adhocSlug lowercases the prompt, replaces every run of non-[a-z0-9]
// characters with "-", trims "-", keeps the first five "-"-separated words,
// cuts to 30 bytes (safe: the slug is ASCII after the replacement) and trims
// a trailing "-".
func adhocSlug(prompt string) string {
	s := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(prompt), "-"), "-")
	if words := strings.Split(s, "-"); len(words) > 5 {
		s = strings.Join(words[:5], "-")
	}
	if len(s) > 30 {
		s = s[:30]
	}
	return strings.TrimRight(s, "-")
}

// adhocHash is the first 6 hex digits of sha256 over the prompt plus a newline
// plus the start time as UTC RFC 3339 with nanoseconds.
func adhocHash(prompt string, start time.Time) string {
	sum := sha256.Sum256([]byte(prompt + "\n" + start.UTC().Format(time.RFC3339Nano)))
	return hex.EncodeToString(sum[:])[:6]
}
