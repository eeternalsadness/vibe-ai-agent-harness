// Package config finds the opencode server boy talks to.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Server is where and how to reach the opencode server.
type Server struct {
	URL      string
	Password string
}

// Resolve finds the server URL and password. Each takes the highest source
// that sets it: BOY_SERVER_URL / BOY_SERVER_PASSWORD, then server_url /
// server_password in ~/.config/boy/config.yaml, then opencode's service.json.
// It reads everything afresh on each call: the service's port and password
// change when it restarts.
func Resolve() (Server, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return Server{}, err
	}

	v := viper.New()
	svc, err := readServiceJSON()
	if err != nil {
		return Server{}, err
	}
	v.SetDefault("server_url", svc.URL)
	v.SetDefault("server_password", svc.Password)

	v.SetConfigFile(filepath.Join(home, ".config", "boy", "config.yaml"))
	if err := v.ReadInConfig(); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return Server{}, fmt.Errorf("reading boy config: %w", err)
	}

	for key, env := range map[string]string{
		"server_url":      "BOY_SERVER_URL",
		"server_password": "BOY_SERVER_PASSWORD",
	} {
		if err := v.BindEnv(key, env); err != nil {
			return Server{}, err
		}
	}

	server := Server{URL: v.GetString("server_url"), Password: v.GetString("server_password")}
	if server.URL == "" {
		return Server{}, errors.New("opencode server not configured: no service.json and no server_url")
	}
	return server, nil
}

// readServiceJSON reads the running opencode service's address and password.
// A missing file is not an error: the other sources may still supply them.
func readServiceJSON() (Server, error) {
	stateHome := os.Getenv("XDG_STATE_HOME")
	if stateHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return Server{}, err
		}
		stateHome = filepath.Join(home, ".local", "state")
	}
	path := filepath.Join(stateHome, "opencode", "service.json")
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return Server{}, nil
	}
	if err != nil {
		return Server{}, err
	}
	var svc struct {
		URL      string `json:"url"`
		Password string `json:"password"`
	}
	if err := json.Unmarshal(raw, &svc); err != nil {
		return Server{}, fmt.Errorf("reading %s: %w", path, err)
	}
	return Server{URL: svc.URL, Password: svc.Password}, nil
}
