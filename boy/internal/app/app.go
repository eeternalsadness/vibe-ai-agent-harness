// Package app implements the boy commands. Each command takes its
// dependencies explicitly so tests can run it in-process.
package app

import (
	"io"
	"time"

	"boy/internal/client"
	"boy/internal/picker"
)

// Deps is everything a command needs from the outside world.
type Deps struct {
	Client    client.Client
	Now       func() time.Time
	Stdout    io.Writer
	Stderr    io.Writer
	WorkDir   string // the directory the command was run from
	ServerURL string // used in error messages

	Picker      picker.Picker
	Interactive bool   // whether stdin is a terminal, so the picker may be opened
	Output      string // "" for the human table, or "json"
}

// StartOptions says what to start. At most one field is set; with neither,
// Start asks through the picker. Both are pointers so that a flag or argument
// given but empty is an error, not the same as absent.
type StartOptions struct {
	Plan   *string // path of an active plan directory; non-nil even when empty, so an empty --plan is an error
	Prompt *string // ad-hoc instructions; non-nil even when blank, so a blank prompt is an error
}

// PromptOptions describes a follow-up to a running or idle coder.
type PromptOptions struct {
	SessionID string
	Text      string
	Steer     bool // redirect the current turn instead of queueing behind it
}

// StatusOptions selects which coders Status reports.
type StatusOptions struct {
	Dir       string // repo to report on; empty means the repo containing WorkDir
	All       bool   // report coders in every repo
	SessionID string // report only this coder
}
