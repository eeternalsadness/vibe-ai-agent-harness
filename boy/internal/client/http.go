package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

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
	return &HTTP{
		baseURL:  strings.TrimRight(baseURL, "/"),
		password: password,
		hc:       &http.Client{Timeout: 30 * time.Second},
	}
}

// do sends one request and decodes a JSON reply into out when out is non-nil.
// Transport failures wrap ErrUnreachable, 401 wraps ErrUnauthorized and 404
// wraps ErrNotFound.
func (c *HTTP) do(ctx context.Context, method, path string, query url.Values, body, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	target := c.baseURL + path
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return err
	}
	req.SetBasicAuth("opencode", c.password)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.hc.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnreachable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnreachable, err)
	}

	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return ErrUnauthorized
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode < 200 || resp.StatusCode > 299:
		return fmt.Errorf("opencode %s %s: %s: %s", method, path, resp.Status, strings.TrimSpace(string(raw)))
	}
	if out == nil || len(bytes.TrimSpace(raw)) == 0 {
		return nil
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("opencode %s %s: unexpected reply: %w", method, path, err)
	}
	return nil
}

// sessionDTO is the part of opencode's Session.Info boy reads.
type sessionDTO struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"projectID"`
	ParentID  *string `json:"parentID"`
	Agent     string  `json:"agent"`
	Outcome   string  `json:"outcome"`
	Time      struct {
		Created float64  `json:"created"`
		Idle    *float64 `json:"idle"`
	} `json:"time"`
	Location struct {
		Directory string `json:"directory"`
	} `json:"location"`
}

func (d sessionDTO) session() Session {
	s := Session{
		ID:        d.ID,
		ProjectID: d.ProjectID,
		Directory: d.Location.Directory,
		Agent:     d.Agent,
		Outcome:   d.Outcome,
		Created:   time.UnixMilli(int64(d.Time.Created)),
	}
	if d.ParentID != nil {
		s.ParentID = *d.ParentID
	}
	if d.Time.Idle != nil {
		s.Idle = time.UnixMilli(int64(*d.Time.Idle))
	}
	return s
}

func sessionPath(id string) string { return "/api/session/" + url.PathEscape(id) }

func (c *HTTP) CreateSession(ctx context.Context, req CreateSessionRequest) (Session, error) {
	body := map[string]any{
		"title":       req.Title,
		"agent":       req.Agent,
		"location":    map[string]string{"directory": req.Directory},
		"permissions": req.Permissions,
	}
	var reply struct {
		Data sessionDTO `json:"data"`
	}
	if err := c.do(ctx, http.MethodPost, "/api/session", nil, body, &reply); err != nil {
		return Session{}, err
	}
	return reply.Data.session(), nil
}

func (c *HTTP) SendPrompt(ctx context.Context, sessionID, text string) error {
	return c.do(ctx, http.MethodPost, sessionPath(sessionID)+"/prompt", nil, map[string]string{"text": text}, nil)
}

func (c *HTTP) ListSessions(ctx context.Context, directory string) ([]Session, error) {
	var sessions []Session
	cursor := ""
	for {
		q := url.Values{"parentID": {"null"}}
		if directory != "" {
			q.Set("directory", directory)
		}
		if cursor != "" {
			q.Set("cursor", cursor)
		}
		var reply struct {
			Data   []sessionDTO `json:"data"`
			Cursor struct {
				Next *string `json:"next"`
			} `json:"cursor"`
		}
		if err := c.do(ctx, http.MethodGet, "/api/session", q, nil, &reply); err != nil {
			return nil, err
		}
		for _, d := range reply.Data {
			sessions = append(sessions, d.session())
		}
		if reply.Cursor.Next == nil || *reply.Cursor.Next == "" {
			return sessions, nil
		}
		cursor = *reply.Cursor.Next
	}
}

func (c *HTTP) GetSession(ctx context.Context, sessionID string) (Session, error) {
	var reply struct {
		Data sessionDTO `json:"data"`
	}
	if err := c.do(ctx, http.MethodGet, sessionPath(sessionID), nil, nil, &reply); err != nil {
		return Session{}, err
	}
	return reply.Data.session(), nil
}

func (c *HTTP) ActiveSessionIDs(ctx context.Context) ([]string, error) {
	var reply struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	if err := c.do(ctx, http.MethodGet, "/api/session/active", nil, nil, &reply); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(reply.Data))
	for id := range reply.Data {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids, nil
}

func (c *HTTP) LatestPrompt(ctx context.Context, sessionID string) (time.Time, bool, error) {
	q := url.Values{"type": {"user"}, "order": {"desc"}, "limit": {"1"}}
	var reply struct {
		Data []struct {
			Time struct {
				Created float64 `json:"created"`
			} `json:"time"`
		} `json:"data"`
	}
	if err := c.do(ctx, http.MethodGet, sessionPath(sessionID)+"/message", q, nil, &reply); err != nil {
		return time.Time{}, false, err
	}
	if len(reply.Data) == 0 {
		return time.Time{}, false, nil
	}
	return time.UnixMilli(int64(reply.Data[0].Time.Created)), true, nil
}

func (c *HTTP) Interrupt(ctx context.Context, sessionID string) error {
	return c.do(ctx, http.MethodPost, sessionPath(sessionID)+"/interrupt", nil, nil, nil)
}

func (c *HTTP) DeleteSession(ctx context.Context, sessionID string) error {
	return c.do(ctx, http.MethodDelete, sessionPath(sessionID), nil, nil, nil)
}

func (c *HTTP) RefreshWorktrees(ctx context.Context, projectID string) error {
	return c.do(ctx, http.MethodPost, "/api/worktree/refresh", nil, map[string]string{"projectID": projectID}, nil)
}

func (c *HTTP) RemoveWorktree(ctx context.Context, projectID, directory string, force bool) error {
	body := map[string]any{"projectID": projectID, "directory": directory, "force": force}
	return c.do(ctx, http.MethodDelete, "/api/worktree", nil, body, nil)
}
