// Notion Team values are normalized to kebab-case before lookup.
// Examples:
// - "Connections & Add-ons" -> "connections-and-add-ons"
// - "Banking Integrations" -> "banking-integrations"
// - "Practice Experience" -> "practice-experience"
// Keep values as `/updates/...` paths for files in `public/updates`.
export const notionRoadmapTeamImageBySlug: Partial<Record<string, string>> = {
  "connections-and-add-ons": "/updates/connections-and-add-ons.png",
  workflow: "/updates/workflow.png",
  "banking-integrations": "/updates/banking.png",
  "practice-experience": "/updates/practice-experience.png",
  "tax-engineering": "/updates/tax-engineering.png",
  mobile: "/updates/mobile.png",
  "marketing-platform": "/updates/marketing-platform.png",
  "practice-growth": "/updates/practice-growth.png",
};
