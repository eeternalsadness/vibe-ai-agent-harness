package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"boy/internal/client"
)

// coderPermissions is the rule set every coder session gets: allow
// everything first, so no action falls through to opencode's default of
// asking, then deny questions. Later rules win. Tuning it is out of scope.
var coderPermissions = []client.Rule{
	{Action: "*", Resource: "*", Effect: "allow"},
	{Action: "question", Resource: "*", Effect: "deny"},
}

// StartOptions is what a start command was given: a plan path and/or a prompt.
type StartOptions struct {
	Plan   string // the --plan path to start ("" when starting a prompt)
	Prompt string // the ad-hoc prompt ("" when starting a plan)
}

// Start starts a coder on a plan or an ad-hoc prompt, or opens the picker when
// given neither. The picker flow is a stub until its own task.
func Start(ctx context.Context, d Deps, opts StartOptions) error {
	switch {
	case opts.Plan != "" && opts.Prompt != "":
		return errors.New("pass a plan or a prompt, not both")
	case opts.Plan != "":
		return startPlan(ctx, d, opts.Plan)
	case opts.Prompt != "":
		if strings.TrimSpace(opts.Prompt) == "" {
			return errors.New("prompt required")
		}
		return startAdhoc(ctx, d, opts.Prompt)
	case d.Interactive:
		return startPicker(ctx, d)
	default:
		return errors.New("plan or prompt required")
	}
}

// startPicker opens the interactive chooser: plan or ad-hoc, then the plan
// or the prompt.
func startPicker(ctx context.Context, d Deps) error {
	repo, err := mainCheckout(d.WorkDir)
	if err != nil {
		return err
	}
	choice, err := d.Picker.Choose("start", []string{"plan", "ad-hoc"})
	if err != nil {
		return err
	}
	switch choice {
	case 0:
		return startPickerPlan(ctx, d, repo)
	case 1:
		line, err := d.Picker.ReadLine("prompt: ")
		if err != nil {
			return err
		}
		if strings.TrimSpace(line) == "" {
			return errors.New("prompt required")
		}
		return startAdhoc(ctx, d, line)
	default:
		return fmt.Errorf("unexpected choice %d", choice)
	}
}

// startPickerPlan lists the active plans and starts the one the user chose.
func startPickerPlan(ctx context.Context, d Deps, repo string) error {
	names, err := activePlans(repo)
	if err != nil {
		return err
	}
	if len(names) == 0 {
		return fmt.Errorf("no active plans in %s", repo)
	}
	idx, err := d.Picker.Choose("plan", names)
	if err != nil {
		return err
	}
	return startPlan(ctx, d, filepath.Join(repo, ".agents", "plans", names[idx]))
}

// activePlans lists the directories under <repo>/.agents/plans except
// archive, sorted by name.
func activePlans(repo string) ([]string, error) {
	dirs, err := os.ReadDir(filepath.Join(repo, ".agents", "plans"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	var names []string
	for _, d := range dirs {
		if !d.IsDir() || d.Name() == "archive" {
			continue
		}
		names = append(names, d.Name())
	}
	sort.Strings(names)
	return names, nil
}

// startAdhoc starts a coder for a free-form prompt: worktree and branch are
// named after the prompt, and the session is prompted with the prompt itself.
func startAdhoc(ctx context.Context, d Deps, prompt string) error {
	repo, err := mainCheckout(d.WorkDir)
	if err != nil {
		return err
	}
	name := AdhocName(prompt, d.Now())
	worktree := worktreePath(repo, name)
	haveWorktree := isDir(worktree)
	if !haveWorktree {
		if _, err := git(repo, "show-ref", "--verify", "--quiet", "refs/heads/"+name); err == nil {
			return fmt.Errorf("branch exists without worktree: %s", name)
		}
	}

	// The first server call: an unreachable server fails before any git change.
	if _, err := activeSet(ctx, d); err != nil {
		return err
	}

	message := fmt.Sprintf("ad-hoc %s started at %s", name, worktree)
	return launch(ctx, d, repo, name, prompt, message, haveWorktree)
}

// startPlan starts a coder on the plan at planPath, or resumes the plan's
// existing coder.
func startPlan(ctx context.Context, d Deps, planPath string) error {
	repo, plan, err := resolvePlan(d.WorkDir, planPath)
	if err != nil {
		return err
	}
	if err := checkPlan(repo, plan); err != nil {
		return err
	}

	worktree := worktreePath(repo, plan)
	haveWorktree := isDir(worktree)
	if !haveWorktree {
		if _, err := git(repo, "show-ref", "--verify", "--quiet", "refs/heads/"+plan); err == nil {
			return fmt.Errorf("branch exists without worktree: %s", plan)
		}
	}

	// The first server call: an unreachable server fails before any git change.
	existing, err := newestSession(ctx, d, worktree)
	if err != nil {
		return err
	}

	if existing == nil {
		message := fmt.Sprintf("plan %s started at %s", plan, worktree)
		return launch(ctx, d, repo, plan, startPrompt(plan), message, haveWorktree)
	}
	return resume(ctx, d, *existing, plan)
}

// Prompt sends a follow-up to a coder. An idle coder gets the text directly;
// a running coder gets it queued, or steered into the running turn when asked.
// It never interrupts.
func Prompt(ctx context.Context, d Deps, sessionID, text string, steer bool) error {
	if err := checkOutput(d.Output); err != nil {
		return err
	}
	if strings.TrimSpace(text) == "" {
		return errors.New("prompt required")
	}

	// The first server call, so an unreachable server fails first.
	active, err := activeSet(ctx, d)
	if err != nil {
		return err
	}
	s, err := coderSession(ctx, d, sessionID)
	if err != nil {
		return err
	}

	delivery, message := "", fmt.Sprintf("prompt sent to session %s", sessionID)
	if active[s.ID] {
		delivery, message = "queue", fmt.Sprintf("prompt queued for session %s", sessionID)
		if steer {
			delivery, message = "steer", fmt.Sprintf("prompt steered into session %s", sessionID)
		}
	}
	if err := d.Client.SendPrompt(ctx, sessionID, text, delivery); err != nil {
		return d.explainServerError(err)
	}

	if err := printEntry(ctx, d, s); err != nil {
		return err
	}
	_, err = fmt.Fprintln(d.Stderr, message)
	return err
}

// resolvePlan resolves planPath, relative to dir, into the main checkout of
// the repo that contains it and the plan's name. The path must name an active
// plan directory, <repo>/.agents/plans/<name>; a missing path is
// "plan not found", a path outside a repo "not a git repository" and any
// other path "not an active plan". Messages use the path as given.
func resolvePlan(dir, planPath string) (repo, plan string, err error) {
	abs := planPath
	if !filepath.IsAbs(planPath) {
		abs = filepath.Join(dir, planPath)
	}
	resolved, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", "", fmt.Errorf("plan not found: %s", planPath)
	}
	repo, err = mainCheckout(filepath.Dir(resolved))
	if err != nil {
		return "", "", fmt.Errorf("not a git repository: %s", planPath)
	}
	if !isDir(resolved) {
		return "", "", fmt.Errorf("not an active plan: %s", planPath)
	}
	want := filepath.Join(repo, ".agents", "plans", filepath.Base(resolved))
	wantResolved, err := filepath.EvalSymlinks(want)
	if err != nil || wantResolved != resolved {
		return "", "", fmt.Errorf("not an active plan: %s", planPath)
	}
	return repo, filepath.Base(resolved), nil
}

// checkPlan reports uncommitted or untracked changes in the plan directory.
func checkPlan(repo, plan string) error {
	rel := filepath.Join(".agents", "plans", plan)
	changes, err := git(repo, "status", "--porcelain", "--", rel)
	if err != nil {
		return err
	}
	if changes != "" {
		return fmt.Errorf("plan has uncommitted changes: %s", plan)
	}
	return nil
}

// newestSession returns the newest top-level session rooted at dir, or nil.
func newestSession(ctx context.Context, d Deps, dir string) (*client.Session, error) {
	sessions, err := d.Client.ListSessions(ctx, dir)
	if err != nil {
		return nil, d.explainServerError(err)
	}
	if len(sessions) == 0 {
		return nil, nil
	}
	sort.SliceStable(sessions, func(i, j int) bool { return sessions[i].Created.After(sessions[j].Created) })
	return &sessions[0], nil
}

// launch creates the worktree (unless it exists), then a coder session in it
// prompted with firstPrompt, and prints the entry and message.
func launch(ctx context.Context, d Deps, repo, name, firstPrompt, message string, haveWorktree bool) error {
	worktree := worktreePath(repo, name)
	if !haveWorktree {
		if err := os.MkdirAll(filepath.Dir(worktree), 0o755); err != nil {
			return err
		}
		if _, err := git(repo, "worktree", "add", "-b", name, worktree, "HEAD"); err != nil {
			return err
		}
	}

	session, err := d.Client.CreateSession(ctx, client.CreateSessionRequest{
		Agent:       "coder",
		Directory:   worktree,
		Permissions: coderPermissions,
	})
	if err != nil {
		return d.explainServerError(err)
	}
	if err := d.Client.RefreshWorktrees(ctx, session.ProjectID); err != nil {
		return d.explainServerError(err)
	}
	if err := d.Client.SendPrompt(ctx, session.ID, firstPrompt, ""); err != nil {
		return d.explainServerError(err)
	}

	if err := printEntry(ctx, d, session); err != nil {
		return err
	}
	_, err = fmt.Fprintln(d.Stderr, message)
	return err
}

// resume handles a plan whose worktree already has a coder session.
func resume(ctx context.Context, d Deps, s client.Session, plan string) error {
	active, err := activeSet(ctx, d)
	if err != nil {
		return err
	}

	var message string
	switch {
	case active[s.ID]:
		message = fmt.Sprintf("plan already running: %s (session %s)", plan, s.ID)
	case countTasks(s.Directory, plan).finished():
		message = fmt.Sprintf("plan already finished: %s (session %s)", plan, s.ID)
	default:
		if err := d.Client.SendPrompt(ctx, s.ID, resumePrompt(plan), ""); err != nil {
			return d.explainServerError(err)
		}
		message = fmt.Sprintf("resumed session %s for %s", s.ID, plan)
	}

	if err := printEntry(ctx, d, s); err != nil {
		return err
	}
	_, err = fmt.Fprintln(d.Stderr, message)
	return err
}

// printEntry prints the session's current status entry as a JSON object.
func printEntry(ctx context.Context, d Deps, s client.Session) error {
	// Re-read the session: starting or resuming changed its state.
	current, err := d.Client.GetSession(ctx, s.ID)
	if err != nil {
		return d.explainServerError(err)
	}
	active, err := activeSet(ctx, d)
	if err != nil {
		return err
	}
	entry, err := buildEntry(ctx, d, current, active)
	if err != nil {
		return err
	}
	return writeJSON(d, entry)
}

func startPrompt(plan string) string {
	return fmt.Sprintf("Implement plan %s. The plan is at .agents/plans/%s/ in your working directory. "+
		"Work through its TODO.md task by task. No one is available to answer questions.", plan, plan)
}

func resumePrompt(plan string) string {
	return fmt.Sprintf("Continue plan %s. Pick up from .agents/plans/%s/TODO.md at the first task not yet marked done.", plan, plan)
}
