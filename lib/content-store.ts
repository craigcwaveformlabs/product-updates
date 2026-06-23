import fs from "node:fs/promises";
import path from "node:path";

export type DetailBlockType = "body" | "heading-lg" | "heading-sm";

export type DetailBlock = {
  type: DetailBlockType;
  text: string;
};

export type ContentUpdate = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  date: string;
  tags: string[];
  storyTags: string[];
  title: string;
  summaryBody: string;
  detailBody?: string[];
  detailBlocks?: DetailBlock[];
  readMoreUrl: string;
  pinnedForStories?: string[];
  pinInDefaultView?: boolean;
};

export type ContentUpdateSource = "manual" | "imported";

const manualUpdatesDir = path.join(process.cwd(), "content", "updates");
const importedUpdatesDir = path.join(process.cwd(), "content", "imported-updates");

const updatesDirs: Record<ContentUpdateSource, string> = {
  manual: manualUpdatesDir,
  imported: importedUpdatesDir,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected non-empty string for ${field}.`);
  }
  return value.trim();
}

function assertStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`Expected string[] for ${field}.`);
  }
  return value.map((entry) => entry.trim());
}

function assertKebabCaseArray(value: unknown, field: string): string[] {
  const parsed = assertStringArray(value, field);
  const invalid = parsed.filter((entry) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry));
  if (invalid.length) {
    throw new Error(`${field} must use kebab-case values. Invalid: ${invalid.join(", ")}.`);
  }
  return parsed;
}

function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean for ${field}.`);
  }
  return value;
}

function assertDetailBlocks(value: unknown): DetailBlock[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected detailBlocks to be an array.");
  }

  return value.map((entry, index) => {
    if (!isObject(entry)) {
      throw new Error(`detailBlocks[${index}] must be an object.`);
    }

    const type = assertNonEmptyString(entry.type, `detailBlocks[${index}].type`);
    const text = assertNonEmptyString(entry.text, `detailBlocks[${index}].text`);

    if (type !== "body" && type !== "heading-lg" && type !== "heading-sm") {
      throw new Error(`detailBlocks[${index}].type must be one of body, heading-lg, heading-sm.`);
    }

    return {
      type,
      text,
    } as DetailBlock;
  });
}

async function ensureUpdatesDir(source: ContentUpdateSource): Promise<void> {
  await fs.mkdir(updatesDirs[source], { recursive: true });
}

function toUpdateFilePath(id: string, source: ContentUpdateSource): string {
  return path.join(updatesDirs[source], `${id}.json`);
}

async function findUpdateSource(id: string): Promise<ContentUpdateSource | null> {
  for (const source of ["manual", "imported"] as const) {
    try {
      await fs.access(toUpdateFilePath(id, source));
      return source;
    } catch {
      // Keep searching.
    }
  }
  return null;
}

async function listContentUpdatesFromDir(source: ContentUpdateSource): Promise<ContentUpdate[]> {
  try {
    const files = (await fs.readdir(updatesDirs[source])).filter((name) => name.endsWith(".json")).sort();
    return await Promise.all(
      files.map(async (fileName) => {
        const fullPath = path.join(updatesDirs[source], fileName);
        const raw = await fs.readFile(fullPath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        return parseAndValidateUpdate(parsed);
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function assertValidId(id: string): string {
  const normalized = id.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Id must be kebab-case.");
  }
  return normalized;
}

export function parseAndValidateUpdate(payload: unknown): ContentUpdate {
  if (!isObject(payload)) {
    throw new Error("Payload must be a JSON object.");
  }

  const id = assertValidId(assertNonEmptyString(payload.id, "id"));
  const imageSrc = assertNonEmptyString(payload.imageSrc, "imageSrc");
  const imageAlt = assertNonEmptyString(payload.imageAlt, "imageAlt");
  const date = assertNonEmptyString(payload.date, "date");
  const title = assertNonEmptyString(payload.title, "title");
  const summaryBody = assertNonEmptyString(payload.summaryBody, "summaryBody");
  const readMoreUrl = assertNonEmptyString(payload.readMoreUrl, "readMoreUrl");
  const tags = assertKebabCaseArray(payload.tags, "tags");
  const storyTags = assertKebabCaseArray(payload.storyTags, "storyTags");

  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`Date "${date}" is not parseable.`);
  }

  const detailBodyRaw = payload.detailBody;
  let detailBody: string[] | undefined;
  if (detailBodyRaw !== undefined) {
    const parsed = assertStringArray(detailBodyRaw, "detailBody");
    detailBody = parsed.length ? parsed : undefined;
  }

  const detailBlocksRaw = payload.detailBlocks;
  let detailBlocks: DetailBlock[] | undefined;
  if (detailBlocksRaw !== undefined) {
    const parsed = assertDetailBlocks(detailBlocksRaw);
    detailBlocks = parsed.length ? parsed : undefined;
  }

  const pinnedForStoriesRaw = payload.pinnedForStories;
  let pinnedForStories: string[] | undefined;
  if (pinnedForStoriesRaw !== undefined) {
    const parsed = assertKebabCaseArray(pinnedForStoriesRaw, "pinnedForStories");
    pinnedForStories = parsed.length ? parsed : undefined;
  }

  const pinInDefaultViewRaw = payload.pinInDefaultView;
  let pinInDefaultView: boolean | undefined;
  if (pinInDefaultViewRaw !== undefined) {
    pinInDefaultView = assertBoolean(pinInDefaultViewRaw, "pinInDefaultView");
  }

  return {
    id,
    imageSrc,
    imageAlt,
    date,
    tags,
    storyTags,
    title,
    summaryBody,
    detailBody,
    detailBlocks,
    readMoreUrl,
    pinnedForStories,
    pinInDefaultView,
  };
}

export async function listContentUpdates(): Promise<ContentUpdate[]> {
  const manualUpdates = await listContentUpdatesFromDir("manual");
  const importedUpdates = await listContentUpdatesFromDir("imported");
  const updates = [...manualUpdates, ...importedUpdates];

  const seenIds = new Set<string>();
  for (const update of updates) {
    if (seenIds.has(update.id)) {
      throw new Error(`Duplicate id "${update.id}" exists across manual and imported content.`);
    }
    seenIds.add(update.id);
  }

  updates.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return updates;
}

export async function getContentUpdateSource(id: string): Promise<ContentUpdateSource | null> {
  const normalizedId = assertValidId(id);
  return findUpdateSource(normalizedId);
}

export async function updateExists(id: string): Promise<boolean> {
  const normalizedId = assertValidId(id);
  return (await findUpdateSource(normalizedId)) !== null;
}

export async function writeContentUpdate(
  update: ContentUpdate,
  source: ContentUpdateSource = "manual",
): Promise<void> {
  await ensureUpdatesDir(source);
  const filePath = toUpdateFilePath(update.id, source);
  await fs.writeFile(filePath, `${JSON.stringify(update, null, 2)}\n`, "utf8");
}

export async function deleteContentUpdate(id: string): Promise<void> {
  const normalized = assertValidId(id);
  const source = await findUpdateSource(normalized);
  if (!source) {
    throw new Error(`Update "${normalized}" was not found.`);
  }
  await fs.unlink(toUpdateFilePath(normalized, source));
}

export async function deleteImportedContentUpdates(): Promise<number> {
  try {
    const files = (await fs.readdir(importedUpdatesDir)).filter((name) => name.endsWith(".json"));
    await Promise.all(files.map((fileName) => fs.unlink(path.join(importedUpdatesDir, fileName))));
    return files.length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return 0;
    }
    throw error;
  }
}
