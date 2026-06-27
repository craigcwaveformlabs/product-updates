import { NextResponse } from "next/server";
import {
  getContentUpdateSource,
  parseAndValidateUpdate,
  type ContentUpdateSource,
  updateExists,
  writeContentUpdate,
} from "@/lib/content-store";
import { notionRoadmapTeamImageBySlug } from "@/lib/notion-roadmap-team-images";

type CsvRow = Record<string, string>;
type ImportFormat = "default" | "notion-roadmap";

type ImportPreviewRow = {
  rowNumber: number;
  id: string;
  title: string;
  imageSrc: string;
  readMoreUrl: string;
  tags: string[];
  storyTags: string[];
  editionIds?: string[];
  exists: boolean;
  action: "create" | "update" | "skip";
};

type NotionImportFilterOptions = {
  excludeInternalProject: boolean;
  requireDates: boolean;
  dateScope: "future-window" | "all-time";
  futureYears: number;
  allowedStatuses: string[];
  allowedTeams: string[];
};

const DEFAULT_NOTION_IMPORT_FILTER_OPTIONS: NotionImportFilterOptions = {
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

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const next = line[index + 1];
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current.trim());
  return fields;
}

function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '"') {
      const next = content[index + 1];
      if (inQuotes && next === '"') {
        current += '""';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === "\n" && !inQuotes) {
      if (current.trim().length > 0) {
        records.push(current);
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    records.push(current);
  }

  return records;
}

function parseCsv(content: string): CsvRow[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawRecords = splitCsvRecords(normalized);

  if (rawRecords.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(rawRecords[0]);
  if (!headers.length) {
    throw new Error("CSV header row is empty.");
  }

  return rawRecords.slice(1).map((record) => {
    const values = parseCsvLine(record);

    // Notion exports can occasionally include uneven row widths; pad/truncate safely.
    const normalizedValues =
      values.length < headers.length
        ? [...values, ...Array(headers.length - values.length).fill("")]
        : values.length > headers.length
          ? values.slice(0, headers.length)
          : values;

    return Object.fromEntries(headers.map((header, index) => [header, normalizedValues[index]]));
  });
}
function splitList(value: string): string[] {
  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitNotionList(value: string): string[] {
  return value
    .split(/[|,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeHeaderName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readRowValue(row: CsvRow, aliases: string[]): string {
  const normalizedAliases = new Set(aliases.map((alias) => normalizeHeaderName(alias)));

  for (const [key, rawValue] of Object.entries(row)) {
    if (!normalizedAliases.has(normalizeHeaderName(key))) {
      continue;
    }

    const value = rawValue.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeNotionImportFilterOptions(
  raw?: Partial<NotionImportFilterOptions>,
): NotionImportFilterOptions {
  const dateScope = raw?.dateScope === "all-time" ? "all-time" : "future-window";
  const futureYearsRaw = Number(raw?.futureYears ?? DEFAULT_NOTION_IMPORT_FILTER_OPTIONS.futureYears);
  const futureYears = Number.isFinite(futureYearsRaw)
    ? Math.min(10, Math.max(0, Math.floor(futureYearsRaw)))
    : DEFAULT_NOTION_IMPORT_FILTER_OPTIONS.futureYears;

  const allowedStatuses = Array.isArray(raw?.allowedStatuses)
    ? raw.allowedStatuses.map((value) => value.trim()).filter(Boolean)
    : DEFAULT_NOTION_IMPORT_FILTER_OPTIONS.allowedStatuses;

  const allowedTeams = Array.isArray(raw?.allowedTeams)
    ? raw.allowedTeams.map((value) => value.trim()).filter(Boolean)
    : DEFAULT_NOTION_IMPORT_FILTER_OPTIONS.allowedTeams;

  return {
    excludeInternalProject:
      typeof raw?.excludeInternalProject === "boolean"
        ? raw.excludeInternalProject
        : DEFAULT_NOTION_IMPORT_FILTER_OPTIONS.excludeInternalProject,
    requireDates:
      typeof raw?.requireDates === "boolean"
        ? raw.requireDates
        : DEFAULT_NOTION_IMPORT_FILTER_OPTIONS.requireDates,
    dateScope,
    futureYears,
    allowedStatuses,
    allowedTeams,
  };
}

function parseBooleanCsvValue(value: string, field: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`${field} must be true/false, 1/0, or yes/no when provided.`);
}

function buildUpdatePayload(row: CsvRow): Record<string, unknown> {
  const requiredFields = [
    "id",
    "imageSrc",
    "imageAlt",
    "date",
    "tags",
    "storyTags",
    "title",
    "summaryBody",
    "readMoreUrl",
  ];

  const missing = requiredFields.filter((field) => !row[field] || !row[field].trim());
  if (missing.length) {
    throw new Error(`Missing required CSV field(s): ${missing.join(", ")}.`);
  }

  const payload: Record<string, unknown> = {
    id: row.id,
    imageSrc: row.imageSrc,
    imageAlt: row.imageAlt,
    date: row.date,
    tags: splitList(row.tags),
    storyTags: splitList(row.storyTags),
    title: row.title,
    summaryBody: row.summaryBody,
    readMoreUrl: row.readMoreUrl,
  };

  if (row.detailBody?.trim()) {
    payload.detailBody = splitList(row.detailBody);
  }

  if (row.editionIds?.trim()) {
    payload.editionIds = splitList(row.editionIds);
  }

  if (row.pinnedForStories?.trim()) {
    payload.pinnedForStories = splitList(row.pinnedForStories);
  }

  if (row.pinInDefaultView?.trim()) {
    payload.pinInDefaultView = parseBooleanCsvValue(row.pinInDefaultView, "pinInDefaultView");
  }

  if (row.detailBlocks?.trim()) {
    try {
      payload.detailBlocks = JSON.parse(row.detailBlocks) as unknown;
    } catch {
      throw new Error("detailBlocks must be valid JSON when provided.");
    }
  }

  return payload;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function createDefaultImageSrc(id: string): string {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 2147483647;
  }

  const slot = (Math.abs(hash) % 6) + 1;
  return `/updates/default-${slot}.png`;
}

function createDefaultReadMoreUrl(title: string): string {
  return `https://www.freeagent.com/blog/?s=${encodeURIComponent(title)}`;
}


function extractNotionTeamSlugs(rawValue: string): string[] {
  return splitNotionList(rawValue)
    .map(normalizeNotionTeamValue)
    .map(toKebabCase)
    .filter(Boolean);
}

function createRoadmapImageSrc(rawTeams: string, id: string): string {
  const teamSlugs = extractNotionTeamSlugs(rawTeams);
  for (const teamSlug of teamSlugs) {
    const mappedImage = notionRoadmapTeamImageBySlug[teamSlug];
    if (mappedImage) {
      return mappedImage;
    }
  }

  return createDefaultImageSrc(id);
}


function parseNotionDateValue(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const rangeParts = value
    .split("→")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const candidate = rangeParts.length ? rangeParts[rangeParts.length - 1] : value;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function parseEndMonthValue(rawValue: string): string | null {
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


function isCheckedValue(rawValue: string): boolean {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return ["true", "yes", "y", "1", "checked", "tick", "ticked", "x", "✓", "✔"].includes(normalized);
}

function normalizeNotionTeamValue(rawValue: string): string {
  return rawValue
    .replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, "")
    .trim();
}

function rowMatchesNotionFilters(
  row: CsvRow,
  options: NotionImportFilterOptions,
): boolean {
  const internalProjectRaw = readRowValue(row, ["team / internal project", "team/internal project"]);
  if (options.excludeInternalProject && isCheckedValue(internalProjectRaw)) {
    return false;
  }

  const rawDate = readRowValue(row, ["dates"]);

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

  // Apply date range filtering only for "future-window" mode.
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

  // Status matching is exact on normalized slugs (e.g. "backlog" does not match "proposal-backlog").
  const allowedStatusSlugs = new Set(options.allowedStatuses.map(toKebabCase).filter(Boolean));
  const statusSlug = toKebabCase(readRowValue(row, ["status", "state", "phase"]));
  if (allowedStatusSlugs.size > 0 && !allowedStatusSlugs.has(statusSlug)) {
    return false;
  }

  const allowedTeamSlugs = new Set(options.allowedTeams.map(toKebabCase).filter(Boolean));
  const teamSlugs = splitNotionList(readRowValue(row, ["teams"]))
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

function buildNotionRoadmapPayload(row: CsvRow, rowNumber: number): Record<string, unknown> {
  const title = readRowValue(row, ["project name", "name", "title", "item", "task"]);
  if (!title) {
    throw new Error("Missing required Notion title field. Use the Project name column.");
  }

  const explicitId = readRowValue(row, ["id", "slug", "key", "identifier"]);
  // Generate ID from explicit ID first, then title, with rowNumber appended for uniqueness
  const baseId = toKebabCase(explicitId || title);
  const id = baseId ? `${baseId}-${rowNumber}` : `notion-row-${rowNumber}`;

  const rawDate = readRowValue(row, [
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
  const fallbackEndMonth = readRowValue(row, ["end month"]);

  const parsedPrimaryDate = parseNotionDateValue(rawDate);
  const parsedFallbackDate = parseEndMonthValue(fallbackEndMonth);
  const date = parsedPrimaryDate ?? parsedFallbackDate ?? new Date().toISOString().slice(0, 10);

  const impact = readRowValue(row, ["impact"]);
  const summaryBody = impact || title;

  const status = readRowValue(row, ["status", "state", "phase"]);
  const normalizedStatus = toKebabCase(status);

  const roadmapStoryValues = splitNotionList(
    readRowValue(row, [
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
  const storyTags: string[] = [];

  const rawTeams = readRowValue(row, ["teams"]);
  const imageSrc =
    readRowValue(row, ["image src", "image", "cover image", "thumbnail", "card image"]) ||
    createRoadmapImageSrc(rawTeams, id);

  const imageAlt =
    readRowValue(row, ["image alt", "alt", "alt text"]) || `${title} roadmap item preview image`;

  const readMoreUrl =
    readRowValue(row, ["read more url", "url", "link", "notion url", "page url"]) ||
    createDefaultReadMoreUrl(title);

  const payload: Record<string, unknown> = {
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

  const editionIds = splitNotionList(readRowValue(row, ["edition ids", "edition id", "edition", "release", "quarter"])).map(toKebabCase).filter(Boolean);
  if (editionIds.length) {
    payload.editionIds = unique(editionIds);
  }

  if (impact) {
    payload.detailBody = [impact];
  }

  const pinnedForStories = splitNotionList(readRowValue(row, ["pinned for stories", "pin stories"]))
    .map(toKebabCase)
    .filter(Boolean);
  if (pinnedForStories.length) {
    payload.pinnedForStories = unique(pinnedForStories);
  }

  const pinInDefaultRaw = readRowValue(row, ["pin in default view", "pinned", "pin default"]);
  if (pinInDefaultRaw) {
    payload.pinInDefaultView = parseBooleanCsvValue(pinInDefaultRaw, "pinInDefaultView");
  }

  return payload;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      csv?: string;
      skipExistingIds?: boolean;
      importFormat?: ImportFormat;
      previewOnly?: boolean;
      notionFilterOptions?: Partial<NotionImportFilterOptions>;
    };

    const csv = body.csv?.trim();
    const skipExistingIds = body.skipExistingIds !== false;
    const importFormat: ImportFormat = body.importFormat ?? "default";
    const previewOnly = body.previewOnly === true;
    const notionFilterOptions = normalizeNotionImportFilterOptions(body.notionFilterOptions);
    const defaultWriteSource: ContentUpdateSource = importFormat === "notion-roadmap" ? "imported" : "manual";

    if (!csv) {
      return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
    }

    if (importFormat !== "default" && importFormat !== "notion-roadmap") {
      return NextResponse.json(
        { error: "Invalid importFormat. Use default or notion-roadmap." },
        { status: 400 },
      );
    }

    const rows = parseCsv(csv);
    const seenIds = new Set<string>();
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let filteredCount = 0;
    const ids: string[] = [];
    const skippedIds: string[] = [];
    const previewRows: ImportPreviewRow[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      try {
        if (importFormat === "notion-roadmap" && !rowMatchesNotionFilters(row, notionFilterOptions)) {
          filteredCount += 1;
          continue;
        }

        const payload =
          importFormat === "notion-roadmap"
            ? buildNotionRoadmapPayload(row, index + 2)
            : buildUpdatePayload(row);

        const validated = parseAndValidateUpdate(payload);

        if (seenIds.has(validated.id)) {
          throw new Error("Duplicate id found in CSV file.");
        }
        seenIds.add(validated.id);

        const exists = await updateExists(validated.id);
        const shouldSkip = exists && skipExistingIds;

        if (previewOnly || importFormat === "notion-roadmap") {
          previewRows.push({
            rowNumber: index + 2,
            id: validated.id,
            title: validated.title,
            imageSrc: validated.imageSrc,
            readMoreUrl: validated.readMoreUrl,
            tags: validated.tags,
            storyTags: validated.storyTags,
            editionIds: validated.editionIds,
            exists,
            action: shouldSkip ? "skip" : exists ? "update" : "create",
          });
        }

        if (shouldSkip) {
          skippedCount += 1;
          skippedIds.push(validated.id);
          continue;
        }

        if (!previewOnly) {
          const targetSource = exists
            ? (await getContentUpdateSource(validated.id)) ?? defaultWriteSource
            : defaultWriteSource;
          await writeContentUpdate(validated, targetSource);
        }

        if (exists) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }

        ids.push(validated.id);
      } catch (rowError) {
        const rowId = (row.id ?? "").trim() || "missing-id";
        throw new Error(
          `Row ${index + 2} failed (${rowId}): ${
            rowError instanceof Error ? rowError.message : "Unknown error"
          }`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      previewOnly,
      importFormat,
      importedCount: rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      filteredCount,
      ids,
      skippedIds,
      previewRows,
      activeNotionFilters: importFormat === "notion-roadmap" ? notionFilterOptions : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import CSV content." },
      { status: 400 },
    );
  }
}
