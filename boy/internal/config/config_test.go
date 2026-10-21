package config

import (
	"path/filepath"
	"testing"

	"boy/internal/testutil"
)

// isolate points HOME and XDG_STATE_HOME at a temporary directory and
// clears the BOY_ variables. It returns the home directory.
func isolate(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_STATE_HOME", filepath.Join(home, ".local", "state"))
	t.Setenv("BOY_SERVER_URL", "")
	t.Setenv("BOY_SERVER_PASSWORD", "")
	return home
}

func writeServiceJSON(t *testing.T, home, url, password string) {
	t.Helper()
	testutil.WriteFile(t, filepath.Join(home, ".local", "state", "opencode", "service.json"),
		`{"id":"x","version":"2.1.1","url":"`+url+`","pid":1,"password":"`+password+`"}`)
}

func writeConfigYAML(t *testing.T, home, content string) {
	t.Helper()
	testutil.WriteFile(t, filepath.Join(home, ".config", "boy", "config.yaml"), content)
}

func TestResolve(t *testing.T) {
	t.Run("only service.json", func(t *testing.T) {
		home := isolate(t)
		writeServiceJSON(t, home, "http://127.0.0.1:1111", "svc-pw")
		assertServer(t, Server{"http://127.0.0.1:1111", "svc-pw"})
	})

	t.Run("config.yaml wins over service.json", func(t *testing.T) {
		home := isolate(t)
		writeServiceJSON(t, home, "http://127.0.0.1:1111", "svc-pw")
		writeConfigYAML(t, home, "server_url: http://cfg:2222\nserver_password: cfg-pw\n")
		assertServer(t, Server{"http://cfg:2222", "cfg-pw"})
	})

	t.Run("environment wins over both", func(t *testing.T) {
		home := isolate(t)
		writeServiceJSON(t, home, "http://127.0.0.1:1111", "svc-pw")
		writeConfigYAML(t, home, "server_url: http://cfg:2222\nserver_password: cfg-pw\n")
		t.Setenv("BOY_SERVER_URL", "http://env:3333")
		t.Setenv("BOY_SERVER_PASSWORD", "env-pw")
		assertServer(t, Server{"http://env:3333", "env-pw"})
	})

	t.Run("an override that sets only the URL leaves the password to the next source", func(t *testing.T) {
		home := isolate(t)
		writeServiceJSON(t, home, "http://127.0.0.1:1111", "svc-pw")
		t.Setenv("BOY_SERVER_URL", "http://env:3333")
		assertServer(t, Server{"http://env:3333", "svc-pw"})
	})

	t.Run("no source gives a URL", func(t *testing.T) {
		isolate(t)
		_, err := Resolve()
		if err == nil || err.Error() != "opencode server not configured: no service.json and no server_url" {
			t.Fatalf("err = %v", err)
		}
	})
}

func assertServer(t *testing.T, want Server) {
	t.Helper()
	got, err := Resolve()
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != want {
		t.Errorf("Resolve = %+v, want %+v", got, want)
	}
}
