package picker

import "errors"

// Terminal is the Picker backed by the real terminal.
type Terminal struct{}

var _ Picker = Terminal{}

func (Terminal) Choose(string, []string) (int, error) { return 0, errors.New("not implemented") }

func (Terminal) ReadLine(string) (string, error) { return "", errors.New("not implemented") }
