package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"boy/internal/client"
)

// isCoder reports whether s is a coder session: top-level and rooted at an
// existing <repo>/.agents/worktrees/<plan> directory.
func isCoder(s client.Session) bool {
	if s.ParentID != "" {
		return false
	}
	_, _, ok := planFromWorktree(s.Directory)
	return ok && isDir(s.Directory)
}

// Status prints one entry per coder, as JSON or the human table.
func Status(ctx context.Context, d Deps, opts StatusOptions) error {
	if err := checkOutput(d.Output); err != nil {
		return err
	}

	// Fetched once per command; it is also the first server call, so an
	// unreachable server fails before anything else.
	active, err := activeSet(ctx, d)
	if err != nil {
		return err
	}

	var sessions []client.Session
	switch {
	case opts.SessionID != "":
		s, err := coderSession(ctx, d, opts.SessionID)
		if err != nil {
			return err
		}
		sessions = []client.Session{s}
	case opts.All:
		all, err := d.Client.ListSessions(ctx, "")
		if err != nil {
			return d.explainServerError(err)
		}
		for _, s := range all {
			if isCoder(s) {
				sessions = append(sessions, s)
			}
		}
	default:
		sessions, err = repoCoders(ctx, d, opts.Dir)
		if err != nil {
			return err
		}
	}

	entries := make([]Entry, 0, len(sessions))
	for _, s := range sessions {
		e, err := buildEntry(ctx, d, s, active)
		if err != nil {
			return err
		}
		entries = append(entries, e)
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Repo != entries[j].Repo {
			return entries[i].Repo < entries[j].Repo
		}
		return entries[i].Branch < entries[j].Branch
	})
	if d.Output == "json" {
		return writeJSON(d, entries)
	}
	return writeTable(d.Stdout, tableRows(entries, opts.All))
}

// coderSession fetches one session and checks that it is a coder.
func coderSession(ctx context.Context, d Deps, id string) (client.Session, error) {
	s, err := d.Client.GetSession(ctx, id)
	if errors.Is(err, client.ErrNotFound) {
		return client.Session{}, fmt.Errorf("session not found: %s", id)
	}
	if err != nil {
		return client.Session{}, d.explainServerError(err)
	}
	if !isCoder(s) {
		return client.Session{}, fmt.Errorf("not a coder session: %s", id)
	}
	return s, nil
}

// repoCoders returns the coder of every worktree under the repo's
// .agents/worktrees/. The server's directory filter matches exactly, so each
// worktree is looked up on its own.
func repoCoders(ctx context.Context, d Deps, dir string) ([]client.Session, error) {
	if dir == "" {
		dir = d.WorkDir
	} else if !filepath.IsAbs(dir) {
		dir = filepath.Join(d.WorkDir, dir)
	}
	repo, err := mainCheckout(dir)
	if err != nil {
		return nil, err
	}

	dirs, err := os.ReadDir(filepath.Join(repo, ".agents", "worktrees"))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	var sessions []client.Session
	for _, entry := range dirs {
		if !entry.IsDir() {
			continue
		}
		s, err := newestSession(ctx, d, filepath.Join(repo, ".agents", "worktrees", entry.Name()))
		if err != nil {
			return nil, err
		}
		if s != nil && isCoder(*s) {
			sessions = append(sessions, *s)
		}
	}
	return sessions, nil
}
