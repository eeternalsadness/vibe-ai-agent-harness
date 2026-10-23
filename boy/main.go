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
func newDeps(cmd *cobra.Command, output string) (app.Deps, error) {
	wd, err := os.Getwd()
	if err != nil {
		return app.Deps{}, err
	}
	server, err := config.Resolve()
	if err != nil {
		return app.Deps{}, err
	}
	return app.Deps{
		Client:    client.NewHTTP(server.URL, server.Password),
		Now:       time.Now,
		Stdout:    cmd.OutOrStdout(),
		Stderr:    cmd.ErrOrStderr(),
		WorkDir:   wd,
		ServerURL: server.URL,

		Picker:      picker.Terminal{},
		Interactive: term.IsTerminal(int(os.Stdin.Fd())),
		Output:      output,
	}, nil
}

func newRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "boy",
		Short:         "Run plan and ad-hoc coders in background git worktrees",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.AddCommand(newStartCmd(), newStatusCmd(), newPromptCmd(), newRemoveCmd())
	return root
}

// addOutputFlag registers -o/--output, which every command that prints a
// coder's status entry takes.
func addOutputFlag(cmd *cobra.Command, output *string) {
	cmd.Flags().StringVarP(output, "output", "o", "", "output format: json (default: a table)")
}

func newStartCmd() *cobra.Command {
	var opts app.StartOptions
	var plan, output string
	cmd := &cobra.Command{
		Use:   `start [-o json] [--plan <path> | "<prompt>"]`,
		Short: "Start a coder on a plan or an ad-hoc prompt in its own worktree",
		Long: "Start a coder on a plan (--plan <path>) or on an ad-hoc prompt, in its own\n" +
			"worktree and branch. With no arguments in a terminal, ask which.",
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 {
				opts.Prompt = &args[0]
			}
			if cmd.Flags().Changed("plan") {
				opts.Plan = &plan
			}
			d, err := newDeps(cmd, output)
			if err != nil {
				return err
			}
			return app.Start(cmd.Context(), d, opts)
		},
	}
	cmd.Flags().StringVar(&plan, "plan", "", "path of an active plan directory, e.g. .agents/plans/my-plan")
	addOutputFlag(cmd, &output)
	return cmd
}

func newStatusCmd() *cobra.Command {
	var opts app.StatusOptions
	var output string
	cmd := &cobra.Command{
		Use:   "status [-o json] [--dir <repo> | --all] [<session-id>]",
		Short: "Report on coders",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd, output)
			if err != nil {
				return err
			}
			if len(args) == 1 {
				opts.SessionID = args[0]
			}
			return app.Status(cmd.Context(), d, opts)
		},
	}
	cmd.Flags().StringVar(&opts.Dir, "dir", "", "repo to report on (default: the repo containing the current directory)")
	cmd.Flags().BoolVarP(&opts.All, "all", "A", false, "report coders in every repo")
	addOutputFlag(cmd, &output)
	return cmd
}

func newPromptCmd() *cobra.Command {
	var opts app.PromptOptions
	var output string
	cmd := &cobra.Command{
		Use:   `prompt [-o json] [--steer] <session-id> "<text>"`,
		Short: "Send a follow-up to a coder",
		Long: "Send a follow-up to a coder. A running coder queues it until the current\n" +
			"turn ends; with --steer it redirects the current turn instead.",
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd, output)
			if err != nil {
				return err
			}
			opts.SessionID, opts.Text = args[0], args[1]
			return app.Prompt(cmd.Context(), d, opts)
		},
	}
	cmd.Flags().BoolVar(&opts.Steer, "steer", false, "redirect the coder's current turn instead of queueing behind it")
	addOutputFlag(cmd, &output)
	return cmd
}

func newRemoveCmd() *cobra.Command {
	var force bool
	cmd := &cobra.Command{
		Use:   "remove [--force] <session-id>",
		Short: "Remove a coder's worktree and session",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd, "")
			if err != nil {
				return err
			}
			return app.Remove(cmd.Context(), d, args[0], force)
		},
	}
	cmd.Flags().BoolVar(&force, "force", false, "remove even if the coder is running, unmerged, or has changes")
	return cmd
}
