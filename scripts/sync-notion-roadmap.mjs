import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "@notionhq/client";

const root = process.cwd();
const importedUpdatesDir = path.join(root, "content", "imported-updates");

const notionRoadmapTeamImageBySlug = {
  "connections-and-add-ons": "/updates/connections-and-add-ons.png",
  workflow: "/updates/workflow.png",
  "banking-integrations": "/updates/banking.png",
  "practice-experience": "/updates/practice-experience.png",
  "tax-engineering": "/updates/tax-engineering.png",
  mobile: "/updates/mobile.png",
  "marketing-platform": "/updates/marketing-platform.png",
  "practice-growth": "/updates/practice-growth.png",
};

const DEFAULT_NOTION_IMPORT_FILTER_OPTIONS = {
  excludeInternalProject: true,
  requireDates: true,
  dateScope: "future-window",
  futureYears: 4,
  allowedStatuses: [
    "Proposal - In Progress",
    "Proposal - For Review",
    "Backlog",
    "Define",
    "Build",
    "Done",
  ],
  allowedTeams: [
    "Connections & Add-ons",
    "Workflow",
    "Banking Integrations",
    "Practice Experience",
    "Tax Engineering",
    "Mobile",
    "Marketing Platform",
    "Practice Growth",
  ],
};

function fail(message) {
  console.error(`[content:sync:notion] ${message}`);
  process.exit(1);
}

function normalizeHeaderName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function toKebabCase(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function unique(values) {
  return Array.from(new Set(values));
}

function splitNotionList(value) {
  return value
    .split(/[|,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNotionTeamValue(rawValue) {
  return rawValue.replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, "").trim();
}

function parseBooleanValue(value, field) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`${field} must be true/false, 1/0, or yes/no when provided.`);
}

function isCheckedValue(rawValue) {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["true", "yes", "y", "1", "checked", "tick", "ticked", "x"].includes(normalized);
}

function createDefaultImageSrc(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 2147483647;
  }

  const slot = (Math.abs(hash) % 6) + 1;
  return `/updates/default-${slot}.png`;
}

function createDefaultReadMoreUrl(title) {
  return `https://www.freeagent.com/blog/?s=${encodeURIComponent(title)}`;
}

function extractNotionTeamSlugs(rawValue) {
  return splitNotionList(rawValue).map(normalizeNotionTeamValue).map(toKebabCase).filter(Boolean);
}

function createRoadmapImageSrc(rawTeams, id) {
  const teamSlugs = extractNotionTeamSlugs(rawTeams);
  for (const teamSlug of teamSlugs) {
    const mappedImage = notionRoadmapTeamImageBySlug[teamSlug];
    if (mappedImage) {
      return mappedImage;
    }
  }

  return createDefaultImageSrc(id);
}

function parseNotionDateValue(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const rangeParts = value
    .split("->")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const candidate = rangeParts.length ? rangeParts[rangeParts.length - 1] : value;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function parseEndMonthValue(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const parts = value.split("-");
  const monthPart = parts.length > 1 ? parts.slice(1).join("-").trim() : value;
  const parsed = Date.parse(monthPart);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected non-empty string for ${field}.`);
  }
  return value.trim();
}

function assertStringArray(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`Expected string[] for ${field}.`);
  }
  return value.map((entry) => entry.trim());
}

function assertKebabCaseArray(value, field) {
  const parsed = assertStringArray(value, field);
  const invalid = parsed.filter((entry) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry));
  if (invalid.length) {
    throw new Error(`${field} must use kebab-case values. Invalid: ${invalid.join(", ")}.`);
  }
  return parsed;
}

function parseAndValidateUpdate(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload must be a JSON object.");
  }

  const id = assertNonEmptyString(payload.id, "id");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("Id must be kebab-case.");
  }

  const imageSrc = assertNonEmptyString(payload.imageSrc, "imageSrc");
  const imageAlt = assertNonEmptyString(payload.imageAlt, "imageAlt");
  const date = assertNonEmptyString(payload.date, "date");
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`Date \"${date}\" is not parseable.`);
  }

  const title = assertNonEmptyString(payload.title, "title");
  const summaryBody = assertNonEmptyString(payload.summaryBody, "summaryBody");
  const readMoreUrl = assertNonEmptyString(payload.readMoreUrl, "readMoreUrl");
  const tags = assertKebabCaseArray(payload.tags, "tags");
  const storyTags = assertKebabCaseArray(payload.storyTags, "storyTags");

  const update = {
    id,
    imageSrc,
    imageAlt,
    date,
    tags,
    storyTags,
    title,
    summaryBody,
    readMoreUrl,
  };

  if (payload.detailBody !== undefined) {
    update.detailBody = assertStringArray(payload.detailBody, "detailBody");
  }

  if (payload.pinnedForStories !== undefined) {
    update.pinnedForStories = assertKebabCaseArray(payload.pinnedForStories, "pinnedForStories");
  }

  if (payload.pinInDefaultView !== undefined) {
    if (typeof payload.pinInDefaultView !== "boolean") {
      throw new Error("Expected boolean for pinInDefaultView.");
    }
    update.pinInDefaultView = payload.pinInDefaultView;
  }

  return update;
}

function normalizeNotionImportFilterOptions() {
  return DEFAULT_NOTION_IMPORT_FILTER_OPTIONS;
}

function flattenRichText(items) {
  if (!Array.isArray(items)) {
    return "";
  }

  return items
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return "";
      }

      if (typeof entry.plain_text === "string") {
        return entry.plain_text;
      }

      if (entry.text && typeof entry.text === "object" && typeof entry.text.content === "string") {
        return entry.text.content;
      }

      return "";
    })
    .join("")
    .trim();
}

function propertyToText(property) {
  if (!property || typeof property !== "object" || typeof property.type !== "string") {
    return "";
  }

  switch (property.type) {
    case "title":
      return flattenRichText(property.title);
    case "rich_text":
      return flattenRichText(property.rich_text);
    case "status":
      return property.status?.name?.trim?.() ?? "";
    case "select":
      return property.select?.name?.trim?.() ?? "";
    case "multi_select":
      return (property.multi_select ?? []).map((entry) => entry?.name?.trim?.()).filter(Boolean).join(", ");
    case "date":
      if (!property.date?.start) {
        return "";
      }
      return property.date.end ? `${property.date.start} -> ${property.date.end}` : property.date.start;
    case "checkbox":
      return property.checkbox ? "true" : "false";
    case "url":
      return property.url?.trim?.() ?? "";
    case "email":
      return property.email?.trim?.() ?? "";
    case "phone_number":
      return property.phone_number?.trim?.() ?? "";
    case "number":
      return property.number === null || property.number === undefined ? "" : String(property.number);
    case "formula":
      if (!property.formula || typeof property.formula.type !== "string") {
        return "";
      }
      if (property.formula.type === "string") {
        return property.formula.string?.trim?.() ?? "";
      }
      if (property.formula.type === "number") {
        return property.formula.number === null || property.formula.number === undefined ? "" : String(property.formula.number);
      }
      if (property.formula.type === "boolean") {
        return property.formula.boolean ? "true" : "false";
      }
      if (property.formula.type === "date") {
        return property.formula.date?.start ?? "";
      }
      return "";
    case "created_time":
      return property.created_time ?? "";
    case "last_edited_time":
      return property.last_edited_time ?? "";
    default:
      return "";
  }
}

function mapProperties(page) {
  const mapped = new Map();
  if (!page || typeof page !== "object" || !page.properties || typeof page.properties !== "object") {
    return mapped;
  }

  for (const [name, property] of Object.entries(page.properties)) {
    mapped.set(normalizeHeaderName(name), propertyToText(property));
  }

  return mapped;
}

function readPropertyValue(propertiesByName, aliases) {
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderName(alias);
    const value = propertiesByName.get(normalizedAlias);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function rowMatchesNotionFilters(values, options) {
  const internalProjectRaw = readPropertyValue(values, ["team / internal project", "team/internal project"]);
  if (options.excludeInternalProject && isCheckedValue(internalProjectRaw)) {
    return false;
  }

  const rawDate = readPropertyValue(values, ["dates"]);

  if (options.requireDates && !rawDate) {
    return false;
  }

  const parsedDateIso = parseNotionDateValue(rawDate);
  if (rawDate && !parsedDateIso) {
    return false;
  }

  if (options.requireDates && !parsedDateIso) {
    return false;
  }

  if (parsedDateIso && options.dateScope === "future-window") {
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const todayIso = todayUtc.toISOString().slice(0, 10);
    const max = new Date(todayUtc);
    max.setUTCFullYear(max.getUTCFullYear() + options.futureYears);
    const maxIso = max.toISOString().slice(0, 10);

    if (parsedDateIso < todayIso || parsedDateIso > maxIso) {
      return false;
    }
  }

  const allowedStatusSlugs = new Set(options.allowedStatuses.map(toKebabCase).filter(Boolean));
  const statusSlug = toKebabCase(readPropertyValue(values, ["status", "state", "phase"]));
  if (allowedStatusSlugs.size > 0 && !allowedStatusSlugs.has(statusSlug)) {
    return false;
  }

  const allowedTeamSlugs = new Set(options.allowedTeams.map(toKebabCase).filter(Boolean));
  const teamSlugs = splitNotionList(readPropertyValue(values, ["teams"]))
    .map(normalizeNotionTeamValue)
    .map(toKebabCase)
    .filter(Boolean);

  if (!teamSlugs.length) {
    return false;
  }

  if (allowedTeamSlugs.size === 0) {
    return true;
  }

  return teamSlugs.some((teamSlug) => allowedTeamSlugs.has(teamSlug));
}

function buildNotionRoadmapPayload(values, rowNumber, notionPageId) {
  const title = readPropertyValue(values, ["project name", "name", "title", "item", "task"]);
  if (!title) {
    throw new Error("Missing required Notion title field. Use the Project name column.");
  }

  const explicitId = readPropertyValue(values, ["id", "slug", "key", "identifier"]);
  const baseId = toKebabCase(explicitId || title);
  const stableSuffix = notionPageId.replace(/-/g, "").slice(0, 8);
  const id = baseId ? `${baseId}-${stableSuffix}` : `notion-row-${rowNumber}-${stableSuffix}`;

  const rawDate = readPropertyValue(values, [
    "dates",
    "date",
    "target date",
    "target",
    "due",
    "due date",
    "created time",
    "last edited time",
    "launch date",
  ]);
  const fallbackEndMonth = readPropertyValue(values, ["end month"]);

  const parsedPrimaryDate = parseNotionDateValue(rawDate);
  const parsedFallbackDate = parseEndMonthValue(fallbackEndMonth);
  const date = parsedPrimaryDate ?? parsedFallbackDate ?? new Date().toISOString().slice(0, 10);

  const impact = readPropertyValue(values, ["impact"]);
  const summaryBody = impact || title;

  const status = readPropertyValue(values, ["status", "state", "phase"]);
  const normalizedStatus = toKebabCase(status);

  const roadmapStoryValues = splitNotionList(
    readPropertyValue(values, [
      "product story",
      "story tags",
      "story",
      "story tag",
      "pillar",
      "roadmap story",
      "track",
    ]),
  )
    .map(toKebabCase)
    .filter(Boolean);

  const roadmapTags = roadmapStoryValues.map((value) => `roadmap-${value}`);
  const roadmapStatusTag = normalizedStatus ? `roadmap-status-${normalizedStatus}` : null;
  const tags = unique([
    "roadmap",
    ...(normalizedStatus === "done" ? [] : ["coming-soon"]),
    ...(roadmapStatusTag ? [roadmapStatusTag] : []),
    ...roadmapTags,
  ]);

  const storyTags = [];

  const rawTeams = readPropertyValue(values, ["teams"]);
  const imageSrc =
    readPropertyValue(values, ["image src", "image", "cover image", "thumbnail", "card image"]) ||
    createRoadmapImageSrc(rawTeams, id);

  const imageAlt = readPropertyValue(values, ["image alt", "alt", "alt text"]) || `${title} roadmap item preview image`;

  const readMoreUrl =
    readPropertyValue(values, ["read more url", "url", "link", "notion url", "page url"]) ||
    createDefaultReadMoreUrl(title);

  const payload = {
    id,
    imageSrc,
    imageAlt,
    date,
    tags,
    storyTags,
    title,
    summaryBody,
    readMoreUrl,
  };

  if (impact) {
    payload.detailBody = [impact];
  }

  const pinnedForStories = splitNotionList(readPropertyValue(values, ["pinned for stories", "pin stories"]))
    .map(toKebabCase)
    .filter(Boolean);
  if (pinnedForStories.length) {
    payload.pinnedForStories = unique(pinnedForStories);
  }

  const pinInDefaultRaw = readPropertyValue(values, ["pin in default view", "pinned", "pin default"]);
  if (pinInDefaultRaw) {
    payload.pinInDefaultView = parseBooleanValue(pinInDefaultRaw, "pinInDefaultView");
  }

  return payload;
}

async function loadExistingImportedIds() {
  try {
    const files = await fs.readdir(importedUpdatesDir);
    return files.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function fetchDatabasePages(notion, databaseId) {
  let startCursor = undefined;
  const pages = [];

  while (true) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const result of response.results) {
      if (result.object === "page") {
        pages.push(result);
      }
    }

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    startCursor = response.next_cursor;
  }

  return pages;
}

async function writeImportedUpdates(updates) {
  await fs.mkdir(importedUpdatesDir, { recursive: true });

  const existingFiles = await fs.readdir(importedUpdatesDir);
  await Promise.all(
    existingFiles
      .filter((name) => name.endsWith(".json"))
      .map((name) => fs.unlink(path.join(importedUpdatesDir, name))),
  );

  await Promise.all(
    updates.map((update) =>
      fs.writeFile(path.join(importedUpdatesDir, `${update.id}.json`), `${JSON.stringify(update, null, 2)}\n`, "utf8"),
    ),
  );
}

async function main() {
  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID ?? process.env.NOTION_ROADMAP_DATABASE_ID;

  if (!notionToken) {
    fail("Missing NOTION_TOKEN.");
  }

  if (!databaseId) {
    fail("Missing NOTION_DATABASE_ID (or NOTION_ROADMAP_DATABASE_ID).");
  }

  const notion = new Client({ auth: notionToken });
  const filterOptions = normalizeNotionImportFilterOptions();

  const pages = await fetchDatabasePages(notion, databaseId);

  const updates = [];
  let filteredCount = 0;

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const values = mapProperties(page);

    if (!rowMatchesNotionFilters(values, filterOptions)) {
      filteredCount += 1;
      continue;
    }

    const payload = buildNotionRoadmapPayload(values, index + 1, page.id);
    updates.push(parseAndValidateUpdate(payload));
  }

  const idSet = new Set();
  for (const update of updates) {
    if (idSet.has(update.id)) {
      fail(`Duplicate id generated: ${update.id}.`);
    }
    idSet.add(update.id);
  }

  updates.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const existingIds = await loadExistingImportedIds();
  const existingSet = new Set(existingIds);
  const newSet = new Set(updates.map((update) => update.id));

  const createdCount = updates.filter((update) => !existingSet.has(update.id)).length;
  const updatedCount = updates.filter((update) => existingSet.has(update.id)).length;
  const deletedCount = existingIds.filter((id) => !newSet.has(id)).length;

  await writeImportedUpdates(updates);

  console.log(
    `[content:sync:notion] Synced ${updates.length} imported updates (created ${createdCount}, updated ${updatedCount}, deleted ${deletedCount}, filtered ${filteredCount}, scanned ${pages.length} pages).`,
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
