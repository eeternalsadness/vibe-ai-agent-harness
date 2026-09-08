import type { Profile } from "../../config"

export default function dynamicTemplate(profile: Profile): string {
  return `# Dynamic Template

Primary Model: ${profile.primary.providerID}/${profile.primary.modelID}
Memory Model: ${profile.memory.providerID}/${profile.memory.modelID}
`
}
