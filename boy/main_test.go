package main

import (
	"testing"

	"github.com/spf13/cobra"
)

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

func TestOutputFlagOnCoderCommands(t *testing.T) {
	for _, name := range []string{"start", "status", "prompt"} {
		var cmd *cobra.Command
		for _, c := range newRootCmd().Commands() {
			if c.Name() == name {
				cmd = c
			}
		}
		if cmd == nil {
			t.Fatalf("no %s command", name)
		}
		long := cmd.Flags().Lookup("output")
		short := cmd.Flags().ShorthandLookup("o")
		if long == nil || short == nil || long != short {
			t.Errorf("%s: --output = %v, -o = %v, want the same flag", name, long, short)
		}
	}
}

func TestStartTakesPlanFlagAndNoDir(t *testing.T) {
	for _, c := range newRootCmd().Commands() {
		if c.Name() != "start" {
			continue
		}
		if c.Flags().Lookup("plan") == nil {
			t.Error("start has no --plan flag")
		}
		if c.Flags().Lookup("dir") != nil {
			t.Error("start still has --dir")
		}
		return
	}
	t.Fatal("no start command")
}

func TestPromptHasSteerFlag(t *testing.T) {
	for _, c := range newRootCmd().Commands() {
		if c.Name() == "prompt" {
			if c.Flags().Lookup("steer") == nil {
				t.Error("prompt has no --steer flag")
			}
			return
		}
	}
	t.Fatal("no prompt command")
}
