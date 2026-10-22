package client

import (
	"context"
	"fmt"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"
)

// Call is one recorded Fake invocation. Args holds the call's arguments by
// name: "session", "directory", "text", "projectID", "force", "request".
type Call struct {
	Name string
	Args map[string]any
}

// Fake is an in-memory Client for command tests. Tests seed and adjust
// its exported state directly, and read Calls afterwards.
type Fake struct {
	mu sync.Mutex

	Sessions map[string]*Session
	Active   map[string]bool
	// Prompts holds each session's user-message times in creation order.
	Prompts map[string][]time.Time
	// Now stamps new sessions and messages.
	Now func() time.Time
	// ProjectID is given to created sessions.
	ProjectID string
	// Failures makes a method return an error; key "*" fails every method.
	Failures map[string]error
	// Calls lists every invocation in order, including failed ones.
	Calls []Call

	nextID int
}

// NewFake returns an empty Fake whose clock is now.
func NewFake(now func() time.Time) *Fake {
	return &Fake{
		Sessions:  map[string]*Session{},
		Active:    map[string]bool{},
		Prompts:   map[string][]time.Time{},
		Failures:  map[string]error{},
		Now:       now,
		ProjectID: "prj_fake",
	}
}

var _ Client = (*Fake)(nil)

// CallsTo returns the recorded calls with the given method name.
func (f *Fake) CallsTo(name string) []Call {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []Call
	for _, c := range f.Calls {
		if c.Name == name {
			out = append(out, c)
		}
	}
	return out
}

// record logs the call and returns the failure configured for it, if any.
func (f *Fake) record(name string, args map[string]any) error {
	f.Calls = append(f.Calls, Call{Name: name, Args: args})
	if err, ok := f.Failures[name]; ok {
		return err
	}
	return f.Failures["*"]
}

func (f *Fake) CreateSession(_ context.Context, req CreateSessionRequest) (Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("CreateSession", map[string]any{"request": req}); err != nil {
		return Session{}, err
	}
	f.nextID++
	s := &Session{
		ID:        fmt.Sprintf("ses_fake%d", f.nextID),
		ProjectID: f.ProjectID,
		Directory: req.Directory,
		Agent:     req.Agent,
		Created:   f.Now(),
	}
	f.Sessions[s.ID] = s
	return *s, nil
}

// SendPrompt records a user message and marks the session running.
func (f *Fake) SendPrompt(_ context.Context, sessionID, text, delivery string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	args := map[string]any{"session": sessionID, "text": text}
	if delivery != "" {
		args["delivery"] = delivery
	}
	if err := f.record("SendPrompt", args); err != nil {
		return err
	}
	s, ok := f.Sessions[sessionID]
	if !ok {
		return ErrNotFound
	}
	f.Prompts[sessionID] = append(f.Prompts[sessionID], f.Now())
	f.Active[sessionID] = true
	s.Idle = time.Time{}
	s.Outcome = ""
	return nil
}

func (f *Fake) ListSessions(_ context.Context, directory string) ([]Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("ListSessions", map[string]any{"directory": directory}); err != nil {
		return nil, err
	}
	var out []Session
	for _, s := range f.Sessions {
		if s.ParentID != "" || (directory != "" && s.Directory != directory) {
			continue
		}
		out = append(out, *s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Created.After(out[j].Created) })
	return out, nil
}

func (f *Fake) GetSession(_ context.Context, sessionID string) (Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("GetSession", map[string]any{"session": sessionID}); err != nil {
		return Session{}, err
	}
	s, ok := f.Sessions[sessionID]
	if !ok {
		return Session{}, ErrNotFound
	}
	return *s, nil
}

func (f *Fake) ActiveSessionIDs(_ context.Context) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("ActiveSessionIDs", map[string]any{}); err != nil {
		return nil, err
	}
	var ids []string
	for id, on := range f.Active {
		if on {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return ids, nil
}

func (f *Fake) LatestPrompt(_ context.Context, sessionID string) (time.Time, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("LatestPrompt", map[string]any{"session": sessionID}); err != nil {
		return time.Time{}, false, err
	}
	times := f.Prompts[sessionID]
	if len(times) == 0 {
		return time.Time{}, false, nil
	}
	return times[len(times)-1], true, nil
}

// Interrupt marks the session idle with outcome "interrupted".
func (f *Fake) Interrupt(_ context.Context, sessionID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("Interrupt", map[string]any{"session": sessionID}); err != nil {
		return err
	}
	s, ok := f.Sessions[sessionID]
	if !ok {
		return ErrNotFound
	}
	delete(f.Active, sessionID)
	s.Idle = f.Now()
	s.Outcome = "interrupted"
	return nil
}

func (f *Fake) DeleteSession(_ context.Context, sessionID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.record("DeleteSession", map[string]any{"session": sessionID}); err != nil {
		return err
	}
	if _, ok := f.Sessions[sessionID]; !ok {
		return ErrNotFound
	}
	delete(f.Sessions, sessionID)
	delete(f.Active, sessionID)
	delete(f.Prompts, sessionID)
	return nil
}

func (f *Fake) RefreshWorktrees(_ context.Context, projectID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.record("RefreshWorktrees", map[string]any{"projectID": projectID})
}

// RemoveWorktree removes the directory the way the server does: with git,
// keeping the branch.
func (f *Fake) RemoveWorktree(_ context.Context, projectID, directory string, force bool) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	args := map[string]any{"projectID": projectID, "directory": directory, "force": force}
	if err := f.record("RemoveWorktree", args); err != nil {
		return err
	}
	common, err := exec.Command("git", "-C", directory, "rev-parse", "--path-format=absolute", "--git-common-dir").Output()
	if err != nil {
		return fmt.Errorf("fake worktree removal: %w", err)
	}
	cmd := []string{"--git-dir=" + strings.TrimSpace(string(common)), "worktree", "remove"}
	if force {
		cmd = append(cmd, "--force")
	}
	if out, err := exec.Command("git", append(cmd, directory)...).CombinedOutput(); err != nil {
		return fmt.Errorf("fake worktree removal: %v: %s", err, out)
	}
	return nil
}
