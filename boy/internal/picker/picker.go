// Package picker is a thin interface over the interactive chooser boy opens
// when a command has no arguments. It mirrors how client is laid out: commands
// depend on the Picker interface only, so tests swap in Fake.
package picker

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/ktr0731/go-fuzzyfinder"
)

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

// Terminal is the real, terminal-backed Picker: go-fuzzyfinder for choices,
// a plain stdin read for the prompt line.
type Terminal struct{}

// NewTerminal returns the real Picker.
func NewTerminal() *Terminal { return &Terminal{} }

var _ Picker = (*Terminal)(nil)

// Choose shows items under header and returns the index the user picked; an
// abort maps to ErrCancelled.
func (t *Terminal) Choose(header string, items []string) (int, error) {
	idx, err := fuzzyfinder.Find(items, func(i int) string { return items[i] },
		fuzzyfinder.WithHeader(header))
	if err != nil {
		if errors.Is(err, fuzzyfinder.ErrAbort) {
			return -1, ErrCancelled
		}
		return -1, err
	}
	return idx, nil
}

// ReadLine prints prompt to stderr and reads one line from stdin; EOF maps to
// ErrCancelled.
func (t *Terminal) ReadLine(prompt string) (string, error) {
	if _, err := fmt.Fprint(os.Stderr, prompt); err != nil {
		return "", err
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil {
		if errors.Is(err, io.EOF) {
			return "", ErrCancelled
		}
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}
