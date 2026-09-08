import { mkdir, writeFile, readdir, copyFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { config, type Profile } from "../config"

export async function findTemplates(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findTemplates(full))
    } else if (/\.[^.]+\.ts$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

// Non-template static files — plain scripts that need no config
// interpolation. Copied verbatim, byte-for-byte. Allowlisted by extension so
// build byproducts (e.g. __pycache__/*.pyc) are never picked up.
const STATIC_FILE_EXTENSIONS = [".sh", ".py"]

export async function findStaticFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findStaticFiles(full))
    } else if (STATIC_FILE_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      files.push(full)
    }
  }
  return files
}

export async function renderTemplates(
  sourceDir: string,
  outputDir: string,
  profile: Profile
): Promise<void> {
  const srcPrefix = sourceDir + "/"

  for (const srcPath of await findTemplates(sourceDir)) {
    const mod = await import(srcPath) as { default: string | ((profile: Profile) => string) }
    const content = typeof mod.default === "function" ? mod.default(profile) : mod.default
    const relative = srcPath.replace(srcPrefix, "").replace(/\.ts$/, "")
    const distPath = join(outputDir, relative)

    await mkdir(dirname(distPath), { recursive: true })
    await writeFile(distPath, content, "utf-8")
    console.log(`wrote ${distPath}`)
  }

  for (const srcPath of await findStaticFiles(sourceDir)) {
    const relative = srcPath.replace(srcPrefix, "")
    const distPath = join(outputDir, relative)

    await mkdir(dirname(distPath), { recursive: true })
    await copyFile(srcPath, distPath)
    console.log(`copied ${distPath}`)
  }
}

// CLI entry point
if (import.meta.main) {
  const platform = process.argv[2] ?? "opencode"
  const profileName = (process.argv[3] ?? config.defaultProfile) as keyof typeof config.profiles

  const profile = config.profiles[profileName]
  if (!profile) {
    console.error(`Unknown profile: "${profileName}". Available: ${Object.keys(config.profiles).join(", ")}`)
    process.exit(1)
  }

  console.log(`Target platform: ${platform}`)
  console.log(`Using profile: ${profileName}`)

  // Derive absolute paths from this file's directory to avoid CWD dependency
  // This ensures render.ts works regardless of current working directory
  const repoRoot = dirname(import.meta.dir)
  const globalDir = join(repoRoot, "src/global")
  const outputDir = join(repoRoot, "dist", platform)

  await renderTemplates(globalDir, outputDir, profile)
}
