package picker

import "fmt"

// Shown is one Choose call a Fake received.
type Shown struct {
	Header string
	Items  []string
}

// Fake is a Picker that returns scripted answers and records what it was
// shown.
type Fake struct {
	// Choices holds the item index to return from each Choose call, in order.
	// A negative index makes that call return ErrCancelled.
	Choices []int
	// Lines holds the text to return from each ReadLine call, in order. Once
	// they run out ReadLine returns ErrCancelled, like a closed stdin.
	Lines []string

	// Shown records every Choose call, in order.
	Shown []Shown
	// Prompts records the prompt of every ReadLine call, in order.
	Prompts []string
}

var _ Picker = (*Fake)(nil)

func (f *Fake) Choose(header string, items []string) (int, error) {
	f.Shown = append(f.Shown, Shown{Header: header, Items: append([]string(nil), items...)})
	if len(f.Choices) == 0 {
		return 0, fmt.Errorf("picker.Fake: unscripted Choose(%q)", header)
	}
	i := f.Choices[0]
	f.Choices = f.Choices[1:]
	if i < 0 {
		return 0, ErrCancelled
	}
	return i, nil
}

func (f *Fake) ReadLine(prompt string) (string, error) {
	f.Prompts = append(f.Prompts, prompt)
	if len(f.Lines) == 0 {
		return "", ErrCancelled
	}
	line := f.Lines[0]
	f.Lines = f.Lines[1:]
	return line, nil
}
