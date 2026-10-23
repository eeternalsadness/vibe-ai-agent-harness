package app

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
)

// Remove deletes a coder's worktree and session. Without force it refuses
// while the coder is running, its branch is unmerged, or its worktree has
// changes. The branch is always kept.
func Remove(ctx context.Context, d Deps, sessionID string, force bool) error {
	active, err := activeSet(ctx, d)
	if err != nil {
		return err
	}
	s, err := coderSession(ctx, d, sessionID)
	if err != nil {
		return err
	}
	repo, branch, _ := planFromWorktree(s.Directory)
	running := active[s.ID]

	if !force {
		if err := checkSafeToRemove(repo, branch, s.Directory, sessionID, running); err != nil {
			return err
		}
	}

	if running {
		if err := d.Client.Interrupt(ctx, s.ID); err != nil {
			return d.explainServerError(err)
		}
	}
	// Refresh first so a worktree the server doesn't know about can still be removed.
	if err := d.Client.RefreshWorktrees(ctx, s.ProjectID); err != nil {
		return d.explainServerError(err)
	}
	if err := d.Client.RemoveWorktree(ctx, s.ProjectID, s.Directory, force); err != nil {
		return d.explainServerError(err)
	}
	if err := d.Client.DeleteSession(ctx, s.ID); err != nil {
		return d.explainServerError(err)
	}

	_, err = fmt.Fprintf(d.Stdout, "removed session %s at %s\n", s.ID, s.Directory)
	return err
}

func checkSafeToRemove(repo, branch, worktree, sessionID string, running bool) error {
	if running {
		return fmt.Errorf("coder is still running: %s", sessionID)
	}

	_, err := git(repo, "merge-base", "--is-ancestor", branch, "HEAD")
	var exit *exec.ExitError
	switch {
	case errors.As(err, &exit) && exit.ExitCode() == 1:
		return fmt.Errorf("branch not merged: %s", branch)
	case err != nil:
		return err
	}

	changes, err := git(worktree, "status", "--porcelain")
	if err != nil {
		return err
	}
	if changes != "" {
		return fmt.Errorf("worktree has uncommitted changes: %s", worktree)
	}
	return nil
}
