import { mkdir, writeFile, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { config } from "../config"

async function findTemplates(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findTemplates(full))
    } else if (entry.name.endsWith(".md.ts")) {
      files.push(full)
    }
  }
  return files
}

// Resolve selected profile from CLI arg
const profileName = (process.argv[2] ?? config.defaultProfile) as keyof typeof config.profiles
const profile = config.profiles[profileName]
if (!profile) {
  console.error(`Unknown profile: "${profileName}". Available: ${Object.keys(config.profiles).join(", ")}`)
  process.exit(1)
}

console.log(`Using profile: ${profileName}`)

const globalDir = join(import.meta.dir, "global")
const srcPrefix = join(import.meta.dir, "global") + "/"

for (const srcPath of await findTemplates(globalDir)) {
  const mod = await import(srcPath) as { default: string | ((profile: typeof profile) => string) }
  const content = typeof mod.default === "function" ? mod.default(profile) : mod.default
  const relative = srcPath.replace(srcPrefix, "").replace(/\.ts$/, "")
  const distPath = join("dist/opencode", relative)

  await mkdir(dirname(distPath), { recursive: true })
  await writeFile(distPath, content, "utf-8")
  console.log(`wrote ${distPath}`)
}
