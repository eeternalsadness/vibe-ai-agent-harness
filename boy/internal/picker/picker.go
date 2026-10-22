// Package picker is a thin interface over the interactive chooser boy opens
// when a command has no arguments. It mirrors how client is laid out: commands
// depend on the Picker interface only, so tests swap in Fake.
package picker

import "errors"

// ErrCancelled is returned when the user aborts at any picker step.
var ErrCancelled = errors.New("cancelled")

// Picker is the interactive surface a command uses.
type Picker interface {
	// Choose shows items under header and returns the index of the item the
	// user selected.
	Choose(header string, items []string) (int, error)
	// ReadLine prints prompt to stderr and reads one line from stdin.
	ReadLine(prompt string) (string, error)
}

// Terminal is the real, terminal-backed Picker. It is a stub for now; the
// go-fuzzyfinder and bufio implementation lands with the picker task.
type Terminal struct{}

// NewTerminal returns the real Picker.
func NewTerminal() *Terminal { return &Terminal{} }

var _ Picker = (*Terminal)(nil)

func (t *Terminal) Choose(header string, items []string) (int, error) {
	return -1, errors.New("picker not implemented yet")
}

func (t *Terminal) ReadLine(prompt string) (string, error) {
	return "", errors.New("picker not implemented yet")
}
