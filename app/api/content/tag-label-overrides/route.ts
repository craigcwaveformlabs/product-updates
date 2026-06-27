import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

type TagLabelOverrides = {
  tags: Record<string, string>;
  storyTags: Record<string, string>;
  editionIds: Record<string, string>;
  editionThemes: Record<string, string>;
};

const overridesFilePath = path.join(process.cwd(), "content", "tag-label-overrides.json");

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function normalizeOverridesMap(value: unknown, field: string): Record<string, string> {
  if (value === undefined) {
    return {};
  }

  if (!isObject(value)) {
    throw new Error(`${field} must be an object of kebab-case keys and non-empty string values.`);
  }

  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isKebabCase(key)) {
      throw new Error(`${field} contains invalid key "${key}". Keys must be kebab-case.`);
    }

    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error(`${field}[${key}] must be a non-empty string.`);
    }

    normalized[key] = raw.trim();
  }

  return normalized;
}

function normalizeTagLabelOverrides(payload: unknown): TagLabelOverrides {
  if (!isObject(payload)) {
    throw new Error("Payload must be a JSON object.");
  }

  return {
    tags: normalizeOverridesMap(payload.tags, "tags"),
    storyTags: normalizeOverridesMap(payload.storyTags, "storyTags"),
    editionIds: normalizeOverridesMap(payload.editionIds, "editionIds"),
    editionThemes: normalizeOverridesMap(payload.editionThemes, "editionThemes"),
  };
}

async function readTagLabelOverrides(): Promise<TagLabelOverrides> {
  try {
    const raw = await fs.readFile(overridesFilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return normalizeTagLabelOverrides(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        tags: {},
        storyTags: {},
        editionIds: {},
        editionThemes: {},
      };
    }
    throw error;
  }
}

export async function GET() {
  try {
    const overrides = await readTagLabelOverrides();
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read tag label overrides." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const overrides = normalizeTagLabelOverrides(payload);

    await fs.mkdir(path.dirname(overridesFilePath), { recursive: true });
    await fs.writeFile(overridesFilePath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");

    return NextResponse.json({ ok: true, overrides });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save tag label overrides." },
      { status: 400 },
    );
  }
}
