// Command boy starts, inspects, and removes background coders, each working
// on a plan or an ad-hoc prompt in its own git worktree through an opencode
// server.
package main

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"boy/internal/app"
	"boy/internal/client"
	"boy/internal/config"
	"boy/internal/picker"
)

func main() {
	if err := newRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// newDeps builds the dependencies shared by every command. The server is
// resolved on every run: its port and password change when it restarts.
func newDeps(cmd *cobra.Command) (app.Deps, error) {
	wd, err := os.Getwd()
	if err != nil {
		return app.Deps{}, err
	}
	server, err := config.Resolve()
	if err != nil {
		return app.Deps{}, err
	}
	return app.Deps{
		Client:      client.NewHTTP(server.URL, server.Password),
		Picker:      picker.NewTerminal(),
		Now:         time.Now,
		Stdout:      cmd.OutOrStdout(),
		Stderr:      cmd.ErrOrStderr(),
		WorkDir:     wd,
		ServerURL:   server.URL,
		Interactive: term.IsTerminal(int(os.Stdin.Fd())),
	}, nil
}

func newRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "boy",
		Short:         "Run background coders in isolated git worktrees",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.AddCommand(newStartCmd(), newPromptCmd(), newStatusCmd(), newRemoveCmd())
	return root
}

func newStartCmd() *cobra.Command {
	var plan, output string
	cmd := &cobra.Command{
		Use:   "start [--plan <path> | \"<prompt>\"]",
		Short: "Start a plan or an ad-hoc coder in its own worktree",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd)
			if err != nil {
				return err
			}
			d.Output = output
			opts := app.StartOptions{Plan: plan}
			if len(args) == 1 {
				opts.Prompt = args[0]
			}
			return app.Start(cmd.Context(), d, opts)
		},
	}
	cmd.Flags().StringVar(&plan, "plan", "", "path to an active plan to start")
	cmd.Flags().StringVarP(&output, "output", "o", "", "output format: json (default: human table)")
	return cmd
}

func newPromptCmd() *cobra.Command {
	var steer bool
	var output string
	cmd := &cobra.Command{
		Use:   "prompt [--steer] <session-id> <text>",
		Short: "Send a follow-up to a coder",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd)
			if err != nil {
				return err
			}
			d.Output = output
			return app.Prompt(cmd.Context(), d, args[0], args[1], steer)
		},
	}
	cmd.Flags().BoolVar(&steer, "steer", false, "redirect the current turn instead of queueing")
	cmd.Flags().StringVarP(&output, "output", "o", "", "output format: json (default: human table)")
	return cmd
}

func newStatusCmd() *cobra.Command {
	var opts app.StatusOptions
	var output string
	cmd := &cobra.Command{
		Use:   "status [--dir <repo> | --all | -A] [<session-id>]",
		Short: "Report on coders",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd)
			if err != nil {
				return err
			}
			d.Output = output
			if len(args) == 1 {
				opts.SessionID = args[0]
			}
			return app.Status(cmd.Context(), d, opts)
		},
	}
	cmd.Flags().StringVar(&opts.Dir, "dir", "", "repo to report on (default: the repo containing the current directory)")
	cmd.Flags().BoolVarP(&opts.All, "all", "A", false, "report coders in every repo")
	cmd.Flags().StringVarP(&output, "output", "o", "", "output format: json (default: human table)")
	return cmd
}

func newRemoveCmd() *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:   "remove [--force] <session-id>",
		Short: "Remove a coder's worktree and session",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd)
			if err != nil {
				return err
			}
			return app.Remove(cmd.Context(), d, args[0], force)
		},
	}
	cmd.Flags().BoolVar(&force, "force", false, "remove even if the coder is running, unmerged, or has changes")
	return cmd
}
