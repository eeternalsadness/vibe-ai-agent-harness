package main

import "testing"

func TestStatusAllHasShorthandA(t *testing.T) {
	for _, c := range newRootCmd().Commands() {
		if c.Name() != "status" {
			continue
		}
		f := c.Flags().ShorthandLookup("A")
		if f == nil || f.Name != "all" {
			t.Fatalf("status -A = %v, want the --all flag", f)
		}
		return
	}
	t.Fatal("no status command")
}

func TestCommandsHaveOutputFlag(t *testing.T) {
	for _, name := range []string{"start", "prompt", "status"} {
		t.Run(name, func(t *testing.T) {
			found := false
			for _, c := range newRootCmd().Commands() {
				if c.Name() != name {
					continue
				}
				found = true
				if f := c.Flags().Lookup("output"); f == nil || f.Shorthand != "o" {
					t.Errorf("%s --output = %v, want -o/--output", name, f)
				}
			}
			if !found {
				t.Fatalf("no %s command", name)
			}
		})
	}
}
