import { mkdir, writeFile, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"

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

const globalDir = join(import.meta.dir, "global")
const srcPrefix = join(import.meta.dir, "global") + "/"

for (const srcPath of await findTemplates(globalDir)) {
  const mod = await import(srcPath) as { default: string }
  const relative = srcPath.replace(srcPrefix, "").replace(/\.ts$/, "")
  const distPath = join("dist/opencode", relative)

  await mkdir(dirname(distPath), { recursive: true })
  await writeFile(distPath, mod.default, "utf-8")
  console.log(`wrote ${distPath}`)
}
