# Plan: Model Profiles

## Goal

Replace the flat `models` object in `config.ts` with named model variables and named profiles. Profile selection happens interactively at install time — no runtime persistence needed.

## Key insight

The memory agent's model is controlled by the `model` frontmatter in `memory.md`, not by the plugin. The plugin invokes `agent: "memory"` and OpenCode uses whatever model is declared in the agent definition. So profile selection only affects the render step.

## Config shape

```ts
// Named model variables — reusable across profiles
const models = {
  claudeSonnet: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
  claudeHaiku:  { providerID: "anthropic", modelID: "claude-haiku-4-5" },
}

// Profiles reference model variables
// Future: add knowledge, research, etc. model slots per profile
export const config = {
  knowledgeBasePath: "...",
  memoryFilePath:    "...",
  harnessPath:       "...",

  profiles: {
    default: {
      primary: models.claudeSonnet,
      memory:  models.claudeHaiku,
    },
  },
}
```

## Flow

1. `install.sh` reads available profile keys from `config.ts` (or hardcodes the list for now)
2. Prompts the user to select one (skips prompt if only `default` exists)
3. Exports `PROFILE=<name>` and calls `bun run src/render.ts`
4. `render.ts` reads `process.env.PROFILE`, looks up `config.profiles[profile]`, passes model refs into template functions
5. `memory.md.ts` accepts a `memoryModel` arg and interpolates `model: providerID/modelID` into frontmatter
6. Plugin: `FALLBACK_MODELS` removed; `model` field removed from `session.prompt` call

## No runtime persistence

The plugin does not need the profile. OpenCode reads the `model` frontmatter from the installed `memory.md`. Selecting a different profile requires re-running `install.sh`.

## Files changed

| File | Change |
|---|---|
| `config.ts` | Replace `models` flat obj with named vars + `profiles` map |
| `src/global/agents/memory/memory.md.ts` | Accept `memoryModel`; interpolate `model` frontmatter |
| `src/render.ts` | Read `PROFILE` env var; pass model refs into template functions that need them |
| `src/platforms/opencode/plugins/memory-manager.ts` | Remove `FALLBACK_MODELS`; remove `model` override from `session.prompt` |
| `install.sh` | Add interactive profile selection; export `PROFILE` before calling render |

## Tasks

See `TODO.md`.
