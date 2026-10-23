package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"text/tabwriter"
	"time"
)

// checkOutput rejects an output format no command knows. Commands call it
// before anything else, so a bad -o never has side effects.
func checkOutput(d Deps) error {
	if d.Output != "" && d.Output != "json" {
		return fmt.Errorf("unknown output format: %s", d.Output)
	}
	return nil
}

// writeEntry prints one coder: a JSON object, or the table with one row.
func writeEntry(d Deps, e Entry) error {
	if d.Output == "json" {
		return writeJSON(d, e)
	}
	return writeTable(d, []Entry{e}, false)
}

// writeEntries prints coders: a JSON array, or the table. withRepo adds the
// REPO column to the table.
func writeEntries(d Deps, entries []Entry, withRepo bool) error {
	if d.Output == "json" {
		if entries == nil {
			entries = []Entry{}
		}
		return writeJSON(d, entries)
	}
	return writeTable(d, entries, withRepo)
}

// writeJSON prints v as indented JSON followed by a newline.
func writeJSON(d Deps, v any) error {
	out, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	_, err = d.Stdout.Write(append(out, '\n'))
	return err
}

// writeTable prints a header row, then one row per entry.
func writeTable(d Deps, entries []Entry, withRepo bool) error {
	tw := tabwriter.NewWriter(d.Stdout, 0, 0, 2, ' ', 0)
	row := func(cells ...string) {
		_, _ = fmt.Fprintln(tw, strings.Join(cells, "\t"))
	}

	header := []string{"SESSION", "STATE", "TASKS", "BRANCH", "AGE", "IN STATE", "TITLE"}
	if withRepo {
		header = append([]string{"REPO"}, header...)
	}
	row(header...)

	for _, e := range entries {
		cells := []string{
			e.Session, e.State, tasksCell(e.Tasks), e.Branch,
			seconds(e.RunningFor), seconds(e.InStateFor), titleCell(e.Title),
		}
		if withRepo {
			cells = append([]string{e.Repo}, cells...)
		}
		row(cells...)
	}
	return tw.Flush()
}

func tasksCell(t *Tasks) string {
	if t == nil {
		return "-"
	}
	return fmt.Sprintf("%d/%d", t.Done, t.Total)
}

func seconds(n int64) string { return (time.Duration(n) * time.Second).String() }

// titleCell flattens whitespace so a title with line breaks stays on one row.
func titleCell(title string) string { return strings.Join(strings.Fields(title), " ") }
