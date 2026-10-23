package app

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"boy/internal/client"
)

// Prompt sends a follow-up to a coder, found by session id. An idle coder
// gets it as a new turn. A running coder queues it behind the current turn,
// or with Steer has the current turn redirected. Nothing is interrupted.
func Prompt(ctx context.Context, d Deps, opts PromptOptions) error {
	if err := checkOutput(d); err != nil {
		return err
	}
	if strings.TrimSpace(opts.Text) == "" {
		return errors.New("prompt required")
	}

	// The first server call: an unreachable server fails before anything else.
	active, err := activeSet(ctx, d)
	if err != nil {
		return err
	}
	s, err := coderSession(ctx, d, opts.SessionID)
	if err != nil {
		return err
	}

	delivery, message := "", "prompt sent to session "+s.ID
	switch {
	case active[s.ID] && opts.Steer:
		delivery, message = client.DeliverySteer, "prompt steered into session "+s.ID
	case active[s.ID]:
		delivery, message = client.DeliveryQueue, "prompt queued for session "+s.ID
	}
	if err := d.Client.SendPrompt(ctx, s.ID, opts.Text, delivery); err != nil {
		return d.explainServerError(err)
	}

	if err := printEntry(ctx, d, s); err != nil {
		return err
	}
	_, err = fmt.Fprintln(d.Stderr, message)
	return err
}
