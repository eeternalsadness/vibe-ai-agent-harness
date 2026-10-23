package picker

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	fuzzyfinder "github.com/ktr0731/go-fuzzyfinder"
)

// Terminal is the Picker backed by the real terminal: go-fuzzyfinder for
// choices and one line of stdin for text.
type Terminal struct{}

var _ Picker = Terminal{}

// Choose opens the fuzzy finder. Esc and Ctrl-C give ErrCancelled.
func (Terminal) Choose(header string, items []string) (int, error) {
	i, err := fuzzyfinder.Find(items, func(i int) string { return items[i] },
		fuzzyfinder.WithHeader(header))
	if errors.Is(err, fuzzyfinder.ErrAbort) {
		return 0, ErrCancelled
	}
	return i, err
}

// ReadLine prints prompt to stderr, keeping stdout free for the command's
// output, and reads one line from stdin. End of input gives ErrCancelled.
func (Terminal) ReadLine(prompt string) (string, error) {
	_, _ = fmt.Fprint(os.Stderr, prompt)
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if errors.Is(err, io.EOF) && line == "" {
		return "", ErrCancelled
	}
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}
