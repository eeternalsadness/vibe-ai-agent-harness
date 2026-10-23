package app

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"boy/internal/client"
)

// Tasks counts the checkboxes of a plan's TODO.md.
type Tasks struct {
	Done    int `json:"done"`
	Skipped int `json:"skipped"`
	Total   int `json:"total"`
}

// Entry is one coder in the status output. Plan and Tasks are nil for an
// ad-hoc coder, which is what marks it as ad-hoc.
type Entry struct {
	Session    string  `json:"session"`
	Repo       string  `json:"repo"`
	Worktree   string  `json:"worktree"`
	Title      string  `json:"title"`
	Plan       *string `json:"plan"`
	Branch     string  `json:"branch"`
	Tasks      *Tasks  `json:"tasks"`
	State      string  `json:"state"`
	Outcome    *string `json:"outcome"`
	StartedAt  string  `json:"started_at"`
	StateSince string  `json:"state_since"`
	RunningFor int64   `json:"running_for"`
	InStateFor int64   `json:"in_state_for"`
}

var checkbox = regexp.MustCompile(`(?m)^\s*- \[([ x-])\]`)

// countTasks reads the TODO.md of a plan inside a worktree. A missing file
// counts as no tasks.
func countTasks(worktree, plan string) Tasks {
	raw, err := os.ReadFile(filepath.Join(worktree, ".agents", "plans", plan, "TODO.md"))
	if err != nil {
		return Tasks{}
	}
	var t Tasks
	for _, m := range checkbox.FindAllSubmatch(raw, -1) {
		t.Total++
		switch string(m[1]) {
		case "x":
			t.Done++
		case "-":
			t.Skipped++
		}
	}
	return t
}

// finished reports whether every task is done or skipped.
func (t Tasks) finished() bool { return t.Total > 0 && t.Done+t.Skipped == t.Total }

// activeSet fetches the ids of running sessions.
func activeSet(ctx context.Context, d Deps) (map[string]bool, error) {
	ids, err := d.Client.ActiveSessionIDs(ctx)
	if err != nil {
		return nil, d.explainServerError(err)
	}
	set := make(map[string]bool, len(ids))
	for _, id := range ids {
		set[id] = true
	}
	return set, nil
}

// buildEntry assembles the status entry for a coder session.
func buildEntry(ctx context.Context, d Deps, s client.Session, active map[string]bool) (Entry, error) {
	repo, name, _ := planFromWorktree(s.Directory)
	now := d.Now()
	e := Entry{
		Session:   s.ID,
		Repo:      repo,
		Worktree:  s.Directory,
		Title:     s.Title,
		Branch:    name,
		State:     "idle",
		StartedAt: s.Created.UTC().Format(time.RFC3339),
	}
	if !isAdhoc(name) {
		tasks := countTasks(s.Directory, name)
		e.Plan, e.Tasks = &name, &tasks
	}
	if s.Outcome != "" {
		outcome := s.Outcome
		e.Outcome = &outcome
	}

	since := s.Created
	if active[s.ID] {
		e.State = "running"
		prompt, found, err := d.Client.LatestPrompt(ctx, s.ID)
		if err != nil {
			return Entry{}, d.explainServerError(err)
		}
		if found {
			since = prompt
		}
	} else if !s.Idle.IsZero() {
		since = s.Idle
	}
	e.StateSince = since.UTC().Format(time.RFC3339)
	e.RunningFor = int64(now.Sub(s.Created).Seconds())
	e.InStateFor = int64(now.Sub(since).Seconds())
	return e, nil
}
