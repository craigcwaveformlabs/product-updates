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
};

const updatesDir = path.join(process.cwd(), "content", "updates");

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
    throw new Error(`Date \"${date}\" is not parseable.`);
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
  };
}

export async function listContentUpdates(): Promise<ContentUpdate[]> {
  const files = (await fs.readdir(updatesDir)).filter((name) => name.endsWith(".json")).sort();
  const updates = await Promise.all(
    files.map(async (fileName) => {
      const fullPath = path.join(updatesDir, fileName);
      const raw = await fs.readFile(fullPath, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      const validated = parseAndValidateUpdate(parsed);
      return validated;
    }),
  );

  updates.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return updates;
}

export async function updateExists(id: string): Promise<boolean> {
  const filePath = path.join(updatesDir, `${id}.json`);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeContentUpdate(update: ContentUpdate): Promise<void> {
  const filePath = path.join(updatesDir, `${update.id}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(update, null, 2)}\n`, "utf8");
}

export async function deleteContentUpdate(id: string): Promise<void> {
  const normalized = assertValidId(id);
  const filePath = path.join(updatesDir, `${normalized}.json`);
  await fs.unlink(filePath);
}
