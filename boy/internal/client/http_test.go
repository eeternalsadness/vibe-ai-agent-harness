package client

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"reflect"
	"testing"
	"time"
)

const testPassword = "s3cret"

// sessionJSON is shaped like a session in opencode v2.0.32 replies. Times
// are epoch milliseconds.
const sessionJSON = `{"id":"ses_1","projectID":"prj_1","parentID":null,"agent":"coder","outcome":"succeeded",` +
	`"title":"fix the bug","cost":0,"tokens":{},"time":{"created":1000,"updated":2000,"idle":3000},` +
	`"location":{"directory":"/repo/.agents/worktrees/p"}}`

// want is what the fake server expects of one request.
type want struct {
	method string
	path   string
	query  url.Values // exact set of expected query params
	body   string     // expected JSON body; empty means no body
}

// reply is what the fake server answers.
type reply struct {
	status int
	body   string
}

// serve starts a server that asserts each incoming request against the
// next entry of wants and answers with the matching entry of replies.
func serve(t *testing.T, wants []want, replies []reply) *HTTP {
	t.Helper()
	var n int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if n >= len(wants) {
			t.Errorf("unexpected extra request %s %s", r.Method, r.URL)
			http.Error(w, "unexpected", http.StatusInternalServerError)
			return
		}
		wt, rp := wants[n], replies[n]
		n++
		if user, pass, ok := r.BasicAuth(); !ok || user != "opencode" || pass != testPassword {
			t.Errorf("auth = %q/%q (ok=%v), want opencode/%s", user, pass, ok, testPassword)
		}
		if r.Method != wt.method || r.URL.Path != wt.path {
			t.Errorf("request = %s %s, want %s %s", r.Method, r.URL.Path, wt.method, wt.path)
		}
		wantQuery := wt.query
		if wantQuery == nil {
			wantQuery = url.Values{}
		}
		if !reflect.DeepEqual(r.URL.Query(), wantQuery) {
			t.Errorf("query = %v, want %v", r.URL.Query(), wantQuery)
		}
		raw, _ := io.ReadAll(r.Body)
		assertBody(t, raw, wt.body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(rp.status)
		_, _ = io.WriteString(w, rp.body)
	}))
	t.Cleanup(func() {
		srv.Close()
		if n != len(wants) {
			t.Errorf("server saw %d requests, want %d", n, len(wants))
		}
	})
	return NewHTTP(srv.URL, testPassword)
}

func assertBody(t *testing.T, got []byte, want string) {
	t.Helper()
	if want == "" {
		if len(got) != 0 {
			t.Errorf("body = %s, want none", got)
		}
		return
	}
	var g, w any
	if err := json.Unmarshal(got, &g); err != nil {
		t.Errorf("body %q is not JSON: %v", got, err)
		return
	}
	if err := json.Unmarshal([]byte(want), &w); err != nil {
		t.Fatalf("bad expected body: %v", err)
	}
	if !reflect.DeepEqual(g, w) {
		t.Errorf("body = %s, want %s", got, want)
	}
}

func ok(body string) reply { return reply{http.StatusOK, body} }

func wantSession1() Session {
	return Session{
		ID: "ses_1", ProjectID: "prj_1", Directory: "/repo/.agents/worktrees/p", Agent: "coder",
		Title: "fix the bug", Created: time.UnixMilli(1000), Idle: time.UnixMilli(3000), Outcome: "succeeded",
	}
}

func TestCreateSession(t *testing.T) {
	// The exact body pins the absence of a title key.
	c := serve(t,
		[]want{{
			method: "POST", path: "/api/session",
			body: `{"agent":"coder","location":{"directory":"/wt"},` +
				`"permissions":[{"action":"*","resource":"*","effect":"allow"},{"action":"question","resource":"*","effect":"deny"}]}`,
		}},
		[]reply{ok(`{"data":` + sessionJSON + `}`)})

	got, err := c.CreateSession(context.Background(), CreateSessionRequest{
		Agent: "coder", Directory: "/wt",
		Permissions: []Rule{
			{Action: "*", Resource: "*", Effect: "allow"},
			{Action: "question", Resource: "*", Effect: "deny"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	assertSession(t, got, wantSession1())
}

func TestSendPrompt(t *testing.T) {
	for _, tc := range []struct {
		name     string
		delivery string
		body     string
	}{
		{name: "no delivery", delivery: "", body: `{"text":"go"}`},
		{name: "queue", delivery: "queue", body: `{"text":"go","delivery":"queue"}`},
		{name: "steer", delivery: "steer", body: `{"text":"go","delivery":"steer"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := serve(t,
				[]want{{method: "POST", path: "/api/session/ses_1/prompt", body: tc.body}},
				[]reply{ok(`{"data":{}`)})
			if err := c.SendPrompt(context.Background(), "ses_1", "go", tc.delivery); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestListSessions(t *testing.T) {
	second := `{"id":"ses_2","projectID":"prj_1","parentID":null,"time":{"created":500,"updated":600},"location":{"directory":"/x"}}`

	t.Run("one worktree's session", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session", query: url.Values{"parentID": {"null"}, "directory": {"/wt"}}}},
			[]reply{ok(`{"data":[` + sessionJSON + `],"cursor":{"previous":null,"next":null}}`)})
		got, err := c.ListSessions(context.Background(), "/wt")
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 1 {
			t.Fatalf("got %d sessions, want 1", len(got))
		}
		assertSession(t, got[0], wantSession1())
	})

	t.Run("no directory filter, follows cursor.next to the last page", func(t *testing.T) {
		c := serve(t,
			[]want{
				{method: "GET", path: "/api/session", query: url.Values{"parentID": {"null"}}},
				{method: "GET", path: "/api/session", query: url.Values{"parentID": {"null"}, "cursor": {"abc"}}},
			},
			[]reply{
				ok(`{"data":[` + sessionJSON + `],"cursor":{"previous":null,"next":"abc"}}`),
				ok(`{"data":[` + second + `],"cursor":{"previous":"zzz","next":null}}`),
			})
		got, err := c.ListSessions(context.Background(), "")
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 2 || got[0].ID != "ses_1" || got[1].ID != "ses_2" {
			t.Fatalf("got %+v, want ses_1 then ses_2", got)
		}
	})
}

func TestGetSession(t *testing.T) {
	t.Run("found", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session/ses_1"}},
			[]reply{ok(`{"data":` + sessionJSON + `}`)})
		got, err := c.GetSession(context.Background(), "ses_1")
		if err != nil {
			t.Fatal(err)
		}
		assertSession(t, got, wantSession1())
	})
	t.Run("404 is ErrNotFound", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session/ses_x"}},
			[]reply{{http.StatusNotFound, `{"_tag":"SessionNotFoundError"}`}})
		if _, err := c.GetSession(context.Background(), "ses_x"); !errors.Is(err, ErrNotFound) {
			t.Fatalf("err = %v, want ErrNotFound", err)
		}
	})
}

func TestActiveSessionIDs(t *testing.T) {
	t.Run("keys of the data object, sorted", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session/active"}},
			[]reply{ok(`{"data":{"ses_b":{"type":"running"},"ses_a":{"type":"running"}}}`)})
		got, err := c.ActiveSessionIDs(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, []string{"ses_a", "ses_b"}) {
			t.Fatalf("got %v", got)
		}
	})
	t.Run("none running", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session/active"}},
			[]reply{ok(`{"data":{}}`)})
		got, err := c.ActiveSessionIDs(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 0 {
			t.Fatalf("got %v, want none", got)
		}
	})
}

func TestLatestPrompt(t *testing.T) {
	q := url.Values{"type": {"user"}, "order": {"desc"}, "limit": {"1"}}
	t.Run("newest user message", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session/ses_1/message", query: q}},
			[]reply{ok(`{"data":[{"id":"msg_1","type":"user","text":"go","time":{"created":5000}}],"cursor":{"previous":null,"next":"n"}}`)})
		got, found, err := c.LatestPrompt(context.Background(), "ses_1")
		if err != nil {
			t.Fatal(err)
		}
		if !found || !got.Equal(time.UnixMilli(5000)) {
			t.Fatalf("got %v, %v; want %v, true", got, found, time.UnixMilli(5000))
		}
	})
	t.Run("no user messages", func(t *testing.T) {
		c := serve(t,
			[]want{{method: "GET", path: "/api/session/ses_1/message", query: q}},
			[]reply{ok(`{"data":[],"cursor":{"previous":null,"next":null}}`)})
		_, found, err := c.LatestPrompt(context.Background(), "ses_1")
		if err != nil {
			t.Fatal(err)
		}
		if found {
			t.Fatal("found = true, want false")
		}
	})
}

func TestInterrupt(t *testing.T) {
	c := serve(t,
		[]want{{method: "POST", path: "/api/session/ses_1/interrupt"}},
		[]reply{ok(`{}`)})
	if err := c.Interrupt(context.Background(), "ses_1"); err != nil {
		t.Fatal(err)
	}
}

func TestDeleteSession(t *testing.T) {
	c := serve(t,
		[]want{{method: "DELETE", path: "/api/session/ses_1"}},
		[]reply{{http.StatusNoContent, ""}})
	if err := c.DeleteSession(context.Background(), "ses_1"); err != nil {
		t.Fatal(err)
	}
}

func TestRefreshWorktrees(t *testing.T) {
	c := serve(t,
		[]want{{method: "POST", path: "/api/worktree/refresh", body: `{"projectID":"prj_1"}`}},
		[]reply{{http.StatusNoContent, ""}})
	if err := c.RefreshWorktrees(context.Background(), "prj_1"); err != nil {
		t.Fatal(err)
	}
}

func TestRemoveWorktree(t *testing.T) {
	c := serve(t,
		[]want{{method: "DELETE", path: "/api/worktree", body: `{"projectID":"prj_1","directory":"/wt","force":true}`}},
		[]reply{{http.StatusNoContent, ""}})
	if err := c.RemoveWorktree(context.Background(), "prj_1", "/wt", true); err != nil {
		t.Fatal(err)
	}
}

func TestUnreachableServer(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	addr := srv.URL
	srv.Close() // nothing listens here any more
	c := NewHTTP(addr, testPassword)
	if _, err := c.ActiveSessionIDs(context.Background()); !errors.Is(err, ErrUnreachable) {
		t.Fatalf("err = %v, want ErrUnreachable", err)
	}
}

func TestRejectedCredentials(t *testing.T) {
	c := serve(t,
		[]want{{method: "GET", path: "/api/session/active"}},
		[]reply{{http.StatusUnauthorized, `{"_tag":"UnauthorizedError"}`}})
	if _, err := c.ActiveSessionIDs(context.Background()); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("err = %v, want ErrUnauthorized", err)
	}
}

func assertSession(t *testing.T, got, want Session) {
	t.Helper()
	if got.ID != want.ID || got.ProjectID != want.ProjectID || got.Directory != want.Directory ||
		got.Agent != want.Agent || got.Title != want.Title || got.Outcome != want.Outcome ||
		got.ParentID != want.ParentID || !got.Created.Equal(want.Created) || !got.Idle.Equal(want.Idle) {
		t.Errorf("session = %+v, want %+v", got, want)
	}
}
