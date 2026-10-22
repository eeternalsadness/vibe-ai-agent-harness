package picker

import "sync"

// Shown is one Choose call the Fake was shown: the header and items.
type Shown struct {
	Header string
	Items  []string
}

// Fake is a scripted Picker for command tests. Tests set ChooseScript and
// ReadScript to the answers the command should receive, then read Shown and
// Prompts to assert what was shown.
type Fake struct {
	mu sync.Mutex

	// ChooseScript is the index returned by each Choose call, in order. When
	// it is exhausted, Choose returns ErrCancelled.
	ChooseScript []int
	// ReadScript is the line returned by each ReadLine call, in order. When it
	// is exhausted, ReadLine returns ErrCancelled.
	ReadScript []string
	// ChooseErr, if set, makes Choose return it instead of the script.
	ChooseErr error
	// ReadErr, if set, makes ReadLine return it instead of the script.
	ReadErr error

	// Shown records every Choose(header, items) in order.
	Shown []Shown
	// Prompts records every ReadLine(prompt) in order.
	Prompts []string
	// Called is true once any method has been invoked.
	Called bool
}

// NewFake returns an empty Fake.
func NewFake() *Fake { return &Fake{} }

var _ Picker = (*Fake)(nil)

func (f *Fake) Choose(header string, items []string) (int, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Called = true
	f.Shown = append(f.Shown, Shown{Header: header, Items: items})
	if f.ChooseErr != nil {
		return -1, f.ChooseErr
	}
	if len(f.ChooseScript) == 0 {
		return -1, ErrCancelled
	}
	idx := f.ChooseScript[0]
	f.ChooseScript = f.ChooseScript[1:]
	return idx, nil
}

func (f *Fake) ReadLine(prompt string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Called = true
	f.Prompts = append(f.Prompts, prompt)
	if f.ReadErr != nil {
		return "", f.ReadErr
	}
	if len(f.ReadScript) == 0 {
		return "", ErrCancelled
	}
	line := f.ReadScript[0]
	f.ReadScript = f.ReadScript[1:]
	return line, nil
}
