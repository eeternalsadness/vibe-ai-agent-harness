package client

import (
	"context"
	"errors"
	"net/http"
	"time"
)

var errNotImplemented = errors.New("not implemented")

// HTTP is the Client backed by a real opencode v2 server.
type HTTP struct {
	baseURL  string
	password string
	hc       *http.Client
}

var _ Client = (*HTTP)(nil)

// NewHTTP returns a client for the server at baseURL, authenticating with
// HTTP Basic auth as user "opencode".
func NewHTTP(baseURL, password string) *HTTP {
	return &HTTP{baseURL: baseURL, password: password, hc: &http.Client{Timeout: 30 * time.Second}}
}

func (c *HTTP) CreateSession(context.Context, CreateSessionRequest) (Session, error) {
	return Session{}, errNotImplemented
}

func (c *HTTP) SendPrompt(context.Context, string, string) error { return errNotImplemented }

func (c *HTTP) ListSessions(context.Context, string) ([]Session, error) {
	return nil, errNotImplemented
}

func (c *HTTP) GetSession(context.Context, string) (Session, error) {
	return Session{}, errNotImplemented
}

func (c *HTTP) ActiveSessionIDs(context.Context) ([]string, error) { return nil, errNotImplemented }

func (c *HTTP) LatestPrompt(context.Context, string) (time.Time, bool, error) {
	return time.Time{}, false, errNotImplemented
}

func (c *HTTP) Interrupt(context.Context, string) error { return errNotImplemented }

func (c *HTTP) DeleteSession(context.Context, string) error { return errNotImplemented }

func (c *HTTP) RefreshWorktrees(context.Context, string) error { return errNotImplemented }

func (c *HTTP) RemoveWorktree(context.Context, string, string, bool) error {
	return errNotImplemented
}
