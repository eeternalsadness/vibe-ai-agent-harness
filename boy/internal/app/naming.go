package app

import (
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

// AdhocName builds an ad-hoc coder's name from the prompt and start time.
// It is a stub for now; the format from ACCEPTANCE.md lands with the naming
// task.
func AdhocName(prompt string, start time.Time) string {
	return adhocPrefix + "stub"
}
