package app

import (
	"context"
	"errors"
	"time"
)

// AdhocName is the name, worktree directory and branch of the ad-hoc coder
// started for prompt at start.
func AdhocName(prompt string, start time.Time) string {
	return ""
}

// Prompt sends a follow-up to a coder.
func Prompt(ctx context.Context, d Deps, opts PromptOptions) error {
	return errors.New("not implemented")
}
