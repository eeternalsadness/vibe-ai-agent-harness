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
	"boy/internal/picker"
)

// archiveDir is the directory under .agents/plans/ that holds archived plans.
// It is not itself a plan.
const archiveDir = "archive"

// coderPermissions is the rule set every coder session gets: allow
// everything first, so no action falls through to opencode's default of
// asking, then deny questions. Later rules win. Tuning it is out of scope.
var coderPermissions = []client.Rule{
	{Action: "*", Resource: "*", Effect: "allow"},
	{Action: "question", Resource: "*", Effect: "deny"},
}

// Start starts a coder on a plan or an ad-hoc prompt, or resumes the plan's
// existing coder. With neither, it asks through the picker.
func Start(ctx context.Context, d Deps, opts StartOptions) error {
	if err := checkOutput(d); err != nil {
		return err
	}
	switch {
	case opts.Plan != nil && opts.Prompt != nil:
		return errors.New("pass a plan or a prompt, not both")
	case opts.Plan != nil:
		return startPlan(ctx, d, *opts.Plan)
	case opts.Prompt != nil:
		return startAdhoc(ctx, d, *opts.Prompt)
	case !d.Interactive:
		return errors.New("plan or prompt required")
	default:
		return startFromPicker(ctx, d)
	}
}

// startPlan starts a coder on the plan directory at path, or resumes the
// plan's existing coder.
func startPlan(ctx context.Context, d Deps, path string) error {
	repo, plan, err := resolvePlan(d, path)
	if err != nil {
		return err
	}
	if err := checkPlanClean(repo, plan); err != nil {
		return err
	}

	worktree := worktreePath(repo, plan)
	haveWorktree := isDir(worktree)
	if !haveWorktree && branchExists(repo, plan) {
		return fmt.Errorf("branch exists without worktree: %s", plan)
	}

	// The first server call: an unreachable server fails before any git change.
	existing, err := newestSession(ctx, d, worktree)
	if err != nil {
		return err
	}

	if existing == nil {
		return launch(ctx, d, repo, plan, haveWorktree, startPrompt(plan))
	}
	return resume(ctx, d, *existing, plan)
}

// resolvePlan turns a --plan path into the main checkout and the name of the
// plan, which must be an active plan: <repo>/.agents/plans/<name> in a main
// checkout, and not the archive directory. Errors echo the path as the user typed it.
func resolvePlan(d Deps, path string) (repo, plan string, err error) {
	if path == "" {
		// An empty --plan would otherwise resolve to the current directory.
		return "", "", errors.New("plan not found: ")
	}
	abs := path
	if !filepath.IsAbs(abs) {
		abs = filepath.Join(d.WorkDir, abs)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return "", "", fmt.Errorf("plan not found: %s", path)
	}
	if !info.IsDir() {
		return "", "", fmt.Errorf("not an active plan: %s", path)
	}
	real, err := filepath.EvalSymlinks(abs)
	if err != nil {
		return "", "", err
	}

	repo, err = mainCheckout(real)
	if err != nil {
		return "", "", fmt.Errorf("not a git repository: %s", path)
	}
	if repo, err = filepath.EvalSymlinks(repo); err != nil {
		return "", "", err
	}
	plan = filepath.Base(real)
	if plan == archiveDir || real != filepath.Join(repo, ".agents", "plans", plan) {
		return "", "", fmt.Errorf("not an active plan: %s", path)
	}
	return repo, plan, nil
}

// checkPlanClean verifies the plan's files are committed, so the worktree
// branched from HEAD holds the same plan.
func checkPlanClean(repo, plan string) error {
	changes, err := git(repo, "status", "--porcelain", "--", filepath.Join(".agents", "plans", plan))
	if err != nil {
		return err
	}
	if changes != "" {
		return fmt.Errorf("plan has uncommitted changes: %s", plan)
	}
	return nil
}

// startAdhoc starts a new coder on prompt in a worktree named for it.
func startAdhoc(ctx context.Context, d Deps, prompt string) error {
	if strings.TrimSpace(prompt) == "" {
		return errors.New("prompt required")
	}
	repo, err := mainCheckout(d.WorkDir)
	if err != nil {
		return err
	}

	name := AdhocName(prompt, d.Now())
	// The name carries a hash of the start time, so a clash needs the same
	// prompt at the same instant. Fail clearly rather than reuse a coder.
	if isDir(worktreePath(repo, name)) {
		return fmt.Errorf("worktree exists: %s", name)
	}
	if branchExists(repo, name) {
		return fmt.Errorf("branch exists without worktree: %s", name)
	}

	// The first server call: an unreachable server fails before any git change.
	if _, err := activeSet(ctx, d); err != nil {
		return err
	}
	return launch(ctx, d, repo, name, false, prompt)
}

// startFromPicker asks whether to start a plan or an ad-hoc prompt, then
// continues as if the answer had been given on the command line.
func startFromPicker(ctx context.Context, d Deps) error {
	repo, err := mainCheckout(d.WorkDir)
	if err != nil {
		return err
	}

	kind, err := d.Picker.Choose("start", []string{"plan", "ad-hoc"})
	if err != nil {
		return explainPickerError(err)
	}
	if kind == 1 {
		line, err := d.Picker.ReadLine("prompt: ")
		if err != nil {
			return explainPickerError(err)
		}
		return startAdhoc(ctx, d, line)
	}

	plans, err := activePlans(repo)
	if err != nil {
		return err
	}
	if len(plans) == 0 {
		return fmt.Errorf("no active plans in %s", repo)
	}
	chosen, err := d.Picker.Choose("plan", plans)
	if err != nil {
		return explainPickerError(err)
	}
	return startPlan(ctx, d, filepath.Join(repo, ".agents", "plans", plans[chosen]))
}

func explainPickerError(err error) error {
	if errors.Is(err, picker.ErrCancelled) {
		return errors.New("cancelled")
	}
	return err
}

// activePlans lists the plan directories under <repo>/.agents/plans/, apart
// from the archive, sorted by name.
func activePlans(repo string) ([]string, error) {
	entries, err := os.ReadDir(filepath.Join(repo, ".agents", "plans"))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var plans []string
	for _, e := range entries {
		if e.IsDir() && e.Name() != archiveDir {
			plans = append(plans, e.Name())
		}
	}
	sort.Strings(plans)
	return plans, nil
}

// branchExists reports whether the repo has a local branch called name.
func branchExists(repo, name string) bool {
	_, err := git(repo, "show-ref", "--verify", "--quiet", "refs/heads/"+name)
	return err == nil
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
// and sends it the first prompt.
func launch(ctx context.Context, d Deps, repo, name string, haveWorktree bool, prompt string) error {
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
	if err := d.Client.SendPrompt(ctx, session.ID, prompt, ""); err != nil {
		return d.explainServerError(err)
	}

	if err := printEntry(ctx, d, session); err != nil {
		return err
	}
	kind := "plan"
	if isAdhoc(name) {
		kind = "ad-hoc"
	}
	_, err = fmt.Fprintf(d.Stderr, "%s %s started at %s\n", kind, name, worktree)
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
	return writeEntry(d, entry)
}

func startPrompt(plan string) string {
	return fmt.Sprintf("Implement plan %s. The plan is at .agents/plans/%s/ in your working directory. "+
		"Work through its TODO.md task by task. No one is available to answer questions.", plan, plan)
}

func resumePrompt(plan string) string {
	return fmt.Sprintf("Continue plan %s. Pick up from .agents/plans/%s/TODO.md at the first task not yet marked done.", plan, plan)
}
