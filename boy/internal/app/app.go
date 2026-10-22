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
	Picker    picker.Picker
	Now       func() time.Time
	Stdout    io.Writer
	Stderr    io.Writer
	WorkDir   string // the directory the command was run from
	ServerURL string // used in error messages
	// Interactive is true when the command can open the picker (stdin is a
	// terminal). main sets it; tests set it directly.
	Interactive bool
	// Output is the requested output format: "" (the human table) or "json".
	Output string
}

// StatusOptions selects which coders Status reports.
type StatusOptions struct {
	Dir       string // repo to report on; empty means the repo containing WorkDir
	All       bool   // report coders in every repo
	SessionID string // report only this coder
}
