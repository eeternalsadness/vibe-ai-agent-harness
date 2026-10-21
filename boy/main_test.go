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
