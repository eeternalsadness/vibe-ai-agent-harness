// Package app implements the boy commands. Each command takes its
// dependencies explicitly so tests can run it in-process.
package app

import (
	"context"
	"errors"
	"io"
	"time"

	"boy/internal/client"
)

// ErrNotImplemented is returned by commands that are not built yet.
var ErrNotImplemented = errors.New("not implemented")

// Deps is everything a command needs from the outside world.
type Deps struct {
	Client    client.Client
	Now       func() time.Time
	Stdout    io.Writer
	Stderr    io.Writer
	WorkDir   string // the directory the command was run from
	ServerURL string // used in error messages
}

// StatusOptions selects which coders Status reports.
type StatusOptions struct {
	Dir       string // repo to report on; empty means the repo containing WorkDir
	All       bool   // report coders in every repo
	SessionID string // report only this coder
}

// Start starts a coder on a plan, or resumes the plan's existing coder.
func Start(_ context.Context, _ Deps, dir, plan string) error {
	return ErrNotImplemented
}

// Status prints a JSON array with one entry per coder.
func Status(_ context.Context, _ Deps, opts StatusOptions) error {
	return ErrNotImplemented
}

// Remove deletes a coder's worktree and session.
func Remove(_ context.Context, _ Deps, sessionID string, force bool) error {
	return ErrNotImplemented
}
