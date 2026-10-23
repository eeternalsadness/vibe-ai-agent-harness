// Package picker asks the user to choose from a list or type a line.
// Commands depend on the Picker interface only, so tests can swap in Fake.
package picker

import "errors"

// ErrCancelled means the user backed out of a prompt.
var ErrCancelled = errors.New("cancelled")

// Picker is every interactive question boy asks.
type Picker interface {
	// Choose shows items under header and returns the index of the chosen one.
	Choose(header string, items []string) (int, error)
	// ReadLine shows prompt and returns one line the user typed.
	ReadLine(prompt string) (string, error)
}
