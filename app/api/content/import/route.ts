import { NextResponse } from "next/server";
import { parseAndValidateUpdate, updateExists, writeContentUpdate } from "@/lib/content-store";

type CsvRow = Record<string, string>;

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

function parseCsv(content: string): CsvRow[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n").filter((line) => line.trim().length > 0);

  if (rawLines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(rawLines[0]);
  if (!headers.length) {
    throw new Error("CSV header row is empty.");
  }

  return rawLines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      throw new Error(`Row ${rowIndex + 2} has ${values.length} column(s); expected ${headers.length}.`);
    }

    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function splitList(value: string): string[] {
  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { csv?: string; skipExistingIds?: boolean };
    const csv = body.csv?.trim();
    const skipExistingIds = body.skipExistingIds !== false;

    if (!csv) {
      return NextResponse.json({ error: "CSV content is required." }, { status: 400 });
    }

    const rows = parseCsv(csv);
    const seenIds = new Set<string>();
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const ids: string[] = [];
    const skippedIds: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rawId = (row.id ?? "").trim();
      if (rawId) {
        if (seenIds.has(rawId)) {
          throw new Error(`Row ${index + 2} failed (${rawId}): Duplicate id found in CSV file.`);
        }
        seenIds.add(rawId);
      }

      try {
        const payload = buildUpdatePayload(row);
        const validated = parseAndValidateUpdate(payload);
        const exists = await updateExists(validated.id);

        if (exists && skipExistingIds) {
          skippedCount += 1;
          skippedIds.push(validated.id);
          continue;
        }

        await writeContentUpdate(validated);

        if (exists) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }

        ids.push(validated.id);
      } catch (rowError) {
        throw new Error(
          `Row ${index + 2} failed (${row.id || "missing-id"}): ${
            rowError instanceof Error ? rowError.message : "Unknown error"
          }`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      importedCount: rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      ids,
      skippedIds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import CSV content." },
      { status: 400 },
    );
  }
}
