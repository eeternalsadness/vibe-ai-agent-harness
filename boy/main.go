// Command boy starts, inspects, and removes background coders, each working
// on a plan in its own git worktree through an opencode server.
package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"boy/internal/app"
)

func main() {
	if err := newRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// newDeps builds the dependencies shared by every command.
func newDeps(cmd *cobra.Command) (app.Deps, error) {
	wd, err := os.Getwd()
	if err != nil {
		return app.Deps{}, err
	}
	return app.Deps{
		Stdout:  cmd.OutOrStdout(),
		Stderr:  cmd.ErrOrStderr(),
		WorkDir: wd,
	}, nil
}

func newRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "boy",
		Short:         "Run plan coders in background git worktrees",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.AddCommand(newStartCmd(), newStatusCmd(), newRemoveCmd())
	return root
}

func newStartCmd() *cobra.Command {
	var dir string
	cmd := &cobra.Command{
		Use:   "start [--dir <repo>] <plan>",
		Short: "Start a coder on a plan in its own worktree",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd)
			if err != nil {
				return err
			}
			return app.Start(cmd.Context(), d, dir, args[0])
		},
	}
	cmd.Flags().StringVar(&dir, "dir", "", "repo to start the plan in (default: the repo containing the current directory)")
	return cmd
}

func newStatusCmd() *cobra.Command {
	var opts app.StatusOptions
	cmd := &cobra.Command{
		Use:   "status [--dir <repo> | --all] [<session-id>]",
		Short: "Report on coders as JSON",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			d, err := newDeps(cmd)
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
