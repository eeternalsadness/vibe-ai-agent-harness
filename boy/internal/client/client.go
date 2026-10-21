// Package client talks to an opencode v2 server. Commands depend on the
// Client interface only, so tests can swap in Fake.
package client

import (
	"context"
	"errors"
	"time"
)

// Errors the commands translate into user-facing messages.
var (
	// ErrNotFound means the server has no such session.
	ErrNotFound = errors.New("not found")
	// ErrUnreachable means the server could not be contacted.
	ErrUnreachable = errors.New("server unreachable")
	// ErrUnauthorized means the server rejected the credentials.
	ErrUnauthorized = errors.New("server rejected credentials")
)

// Rule is one entry of a session permission rule set.
type Rule struct {
	Action   string `json:"action"`
	Resource string `json:"resource"`
	Effect   string `json:"effect"`
}

// Session is the part of an opencode session boy needs.
type Session struct {
	ID        string
	ProjectID string
	ParentID  string // empty for top-level sessions
	Directory string
	Agent     string
	Created   time.Time
	Idle      time.Time // zero while the session has never gone idle
	Outcome   string    // empty before the first turn ends
}

// CreateSessionRequest describes a new session.
type CreateSessionRequest struct {
	Title       string
	Agent       string
	Directory   string
	Permissions []Rule
}

// Client is every opencode call boy makes.
type Client interface {
	// CreateSession creates a session rooted at req.Directory.
	CreateSession(ctx context.Context, req CreateSessionRequest) (Session, error)
	// SendPrompt queues a prompt on the session without waiting for the reply.
	SendPrompt(ctx context.Context, sessionID, text string) error
	// ListSessions returns top-level sessions, newest first. A non-empty
	// directory restricts the result to sessions rooted exactly there.
	ListSessions(ctx context.Context, directory string) ([]Session, error)
	// GetSession returns one session, or ErrNotFound.
	GetSession(ctx context.Context, sessionID string) (Session, error)
	// ActiveSessionIDs returns the ids of running sessions.
	ActiveSessionIDs(ctx context.Context) ([]string, error)
	// LatestPrompt returns when the newest user message was created; ok is
	// false when the session has none.
	LatestPrompt(ctx context.Context, sessionID string) (created time.Time, ok bool, err error)
	// Interrupt stops a running session.
	Interrupt(ctx context.Context, sessionID string) error
	// DeleteSession deletes a session.
	DeleteSession(ctx context.Context, sessionID string) error
	// RefreshWorktrees asks the server to rescan the project's git worktrees.
	RefreshWorktrees(ctx context.Context, projectID string) error
	// RemoveWorktree deletes a worktree through the server, keeping its branch.
	RemoveWorktree(ctx context.Context, projectID, directory string, force bool) error
}
