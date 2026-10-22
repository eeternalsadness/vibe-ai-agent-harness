package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"boy/internal/client"
)

// Tasks counts the checkboxes of a plan's TODO.md.
type Tasks struct {
	Done    int `json:"done"`
	Skipped int `json:"skipped"`
	Total   int `json:"total"`
}

// Entry is one coder in the status output.
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
	if !IsAdhocName(name) {
		plan := name
		tasks := countTasks(s.Directory, name)
		e.Plan = &plan
		e.Tasks = &tasks
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

// tableHeader is the human-table header, without the REPO column.
var tableHeader = []string{"SESSION", "STATE", "TASKS", "BRANCH", "AGE", "IN STATE", "TITLE"}

// entryRow is one coder as human-table cells; repo prepends the repo column.
func entryRow(e Entry, repo bool) []string {
	tasks := "-"
	if e.Tasks != nil {
		tasks = fmt.Sprintf("%d/%d", e.Tasks.Done, e.Tasks.Total)
	}
	row := []string{
		e.Session,
		e.State,
		tasks,
		e.Branch,
		(time.Duration(e.RunningFor) * time.Second).String(),
		(time.Duration(e.InStateFor) * time.Second).String(),
		e.Title,
	}
	if repo {
		row = append([]string{e.Repo}, row...)
	}
	return row
}

// tableRows is the header plus one row per entry.
func tableRows(entries []Entry, repo bool) [][]string {
	header := make([]string, 0, len(tableHeader)+1)
	if repo {
		header = append(header, "REPO")
	}
	header = append(header, tableHeader...)
	rows := [][]string{header}
	for _, e := range entries {
		rows = append(rows, entryRow(e, repo))
	}
	return rows
}

// writeTable writes rows, header first: columns padded to their width,
// separated by two spaces, one row per line.
func writeTable(w io.Writer, rows [][]string) error {
	widths := make([]int, len(rows[0]))
	for _, r := range rows {
		for i, c := range r {
			if len(c) > widths[i] {
				widths[i] = len(c)
			}
		}
	}
	for _, r := range rows {
		var b strings.Builder
		for j, c := range r {
			if j > 0 {
				b.WriteString("  ")
			}
			if j < len(r)-1 {
				fmt.Fprintf(&b, "%-*s", widths[j], c)
			} else {
				b.WriteString(c)
			}
		}
		if _, err := fmt.Fprintln(w, b.String()); err != nil {
			return err
		}
	}
	return nil
}

// writeJSON prints v as indented JSON followed by a newline.
func writeJSON(d Deps, v any) error {
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	_, err = d.Stdout.Write(append(out, '\n'))
	return err
}
