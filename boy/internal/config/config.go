// Package config finds the opencode server boy talks to.
package config

import "errors"

// Server is where and how to reach the opencode server.
type Server struct {
	URL      string
	Password string
}

// Resolve finds the server URL and password. Each takes the highest source
// that sets it: BOY_SERVER_URL / BOY_SERVER_PASSWORD, then server_url /
// server_password in ~/.config/boy/config.yaml, then opencode's service.json.
func Resolve() (Server, error) {
	return Server{}, errors.New("not implemented")
}
