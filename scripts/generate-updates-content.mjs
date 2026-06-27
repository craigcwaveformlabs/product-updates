import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manualUpdatesDir = path.join(root, "content", "updates");
const importedUpdatesDir = path.join(root, "content", "imported-updates");
const editionsDir = path.join(root, "content", "editions");
const tagLabelOverridesFile = path.join(root, "content", "tag-label-overrides.json");
const outputFile = path.join(root, "app", "content", "generated", "updates.generated.ts");

function fail(message) {
  console.error(`[content:generate] ${message}`);
  process.exit(1);
}

function assertString(obj, key, fileName) {
  const value = obj[key];
  if (typeof value !== "string" || !value.trim()) {
    fail(`${fileName}: expected non-empty string field "${key}".`);
  }
}

function assertStringArray(obj, key, fileName) {
  const value = obj[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    fail(`${fileName}: expected string[] field "${key}".`);
  }
}

function assertKebabCaseArray(obj, key, fileName) {
  assertStringArray(obj, key, fileName);
  const invalidValues = obj[key].filter((entry) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry));
  if (invalidValues.length) {
    fail(`${fileName}: ${key} must use kebab-case values. Invalid: ${invalidValues.join(", ")}.`);
  }
}

function assertObject(value, fieldName, fileName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${fileName}: ${fieldName} must be an object.`);
  }
}

function assertOptionalString(value, fieldName, fileName) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    fail(`${fileName}: ${fieldName} must be a non-empty string when provided.`);
  }
  return value;
}

function assertOptionalKebabCaseArray(obj, key, fileName) {
  if (obj[key] === undefined) {
    return undefined;
  }
  assertKebabCaseArray(obj, key, fileName);
  return obj[key];
}

function assertDetailBlocks(raw, fileName) {
  if (!Array.isArray(raw.detailBlocks)) {
    fail(`${fileName}: detailBlocks must be an array.`);
  }

  for (const [index, entry] of raw.detailBlocks.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`${fileName}: detailBlocks[${index}] must be an object.`);
    }

    if (typeof entry.type !== "string" || !entry.type.trim()) {
      fail(`${fileName}: detailBlocks[${index}].type must be a non-empty string.`);
    }

    if (!["body", "heading-lg", "heading-sm"].includes(entry.type)) {
      fail(`${fileName}: detailBlocks[${index}].type must be one of body, heading-lg, heading-sm.`);
    }

    if (typeof entry.text !== "string" || !entry.text.trim()) {
      fail(`${fileName}: detailBlocks[${index}].text must be a non-empty string.`);
    }
  }
}

function validateUpdate(raw, fileName) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`${fileName}: content must be a JSON object.`);
  }

  const requiredStringFields = [
    "id",
    "imageSrc",
    "imageAlt",
    "date",
    "title",
    "summaryBody",
    "readMoreUrl",
  ];

  for (const field of requiredStringFields) {
    assertString(raw, field, fileName);
  }

  assertKebabCaseArray(raw, "tags", fileName);
  assertKebabCaseArray(raw, "storyTags", fileName);

  if (raw.detailBody !== undefined) {
    assertStringArray(raw, "detailBody", fileName);
  }

  if (raw.detailBlocks !== undefined) {
    assertDetailBlocks(raw, fileName);
  }

  if (raw.pinnedForStories !== undefined) {
    assertKebabCaseArray(raw, "pinnedForStories", fileName);
  }

  if (raw.pinInDefaultView !== undefined && typeof raw.pinInDefaultView !== "boolean") {
    fail(`${fileName}: pinInDefaultView must be a boolean when provided.`);
  }

  const editionIds = assertOptionalKebabCaseArray(raw, "editionIds", fileName);

  const parsedDate = Date.parse(raw.date);
  if (Number.isNaN(parsedDate)) {
    fail(`${fileName}: date "${raw.date}" is not parseable.`);
  }

  return {
    id: raw.id,
    imageSrc: raw.imageSrc,
    imageAlt: raw.imageAlt,
    date: raw.date,
    tags: raw.tags,
    storyTags: raw.storyTags,
    title: raw.title,
    summaryBody: raw.summaryBody,
    detailBody: raw.detailBody,
    detailBlocks: raw.detailBlocks,
    readMoreUrl: raw.readMoreUrl,
    pinnedForStories: raw.pinnedForStories,
    pinInDefaultView: raw.pinInDefaultView,
    editionIds,
    _sortDate: parsedDate,
  };
}

function validateEdition(raw, fileName) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`${fileName}: content must be a JSON object.`);
  }

  const requiredStringFields = ["id", "label", "theme", "startDate", "endDate", "status"];
  for (const field of requiredStringFields) {
    assertString(raw, field, fileName);
  }

  if (!["draft", "live", "archived"].includes(raw.status)) {
    fail(`${fileName}: status must be one of draft, live, archived.`);
  }

  if (raw.active !== undefined && typeof raw.active !== "boolean") {
    fail(`${fileName}: active must be a boolean when provided.`);
  }

  if (raw.branding !== undefined) {
    assertObject(raw.branding, "branding", fileName);
  }

  if (raw.storyTagConfig !== undefined) {
    assertObject(raw.storyTagConfig, "storyTagConfig", fileName);

    if (raw.storyTagConfig.order !== undefined) {
      assertKebabCaseArray(raw.storyTagConfig, "order", `${fileName} storyTagConfig`);
    }

    if (raw.storyTagConfig.hidden !== undefined) {
      assertKebabCaseArray(raw.storyTagConfig, "hidden", `${fileName} storyTagConfig`);
    }

    if (raw.storyTagConfig.labelOverrides !== undefined) {
      assertObject(raw.storyTagConfig.labelOverrides, "storyTagConfig.labelOverrides", fileName);
      for (const [key, value] of Object.entries(raw.storyTagConfig.labelOverrides)) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
          fail(`${fileName}: storyTagConfig.labelOverrides key "${key}" must be kebab-case.`);
        }
        if (typeof value !== "string" || !value.trim()) {
          fail(`${fileName}: storyTagConfig.labelOverrides[${key}] must be a non-empty string.`);
        }
      }
    }
  }

  const startTimestamp = Date.parse(raw.startDate);
  const endTimestamp = Date.parse(raw.endDate);

  if (Number.isNaN(startTimestamp)) {
    fail(`${fileName}: startDate "${raw.startDate}" is not parseable.`);
  }

  if (Number.isNaN(endTimestamp)) {
    fail(`${fileName}: endDate "${raw.endDate}" is not parseable.`);
  }

  if (startTimestamp > endTimestamp) {
    fail(`${fileName}: startDate must be before or equal to endDate.`);
  }

  const branding = raw.branding
    ? {
        palette: assertOptionalString(raw.branding.palette, "branding.palette", fileName),
        accentColor: assertOptionalString(raw.branding.accentColor, "branding.accentColor", fileName),
        heroStyle: assertOptionalString(raw.branding.heroStyle, "branding.heroStyle", fileName),
        fontFamily: assertOptionalString(raw.branding.fontFamily, "branding.fontFamily", fileName),
      }
    : undefined;

  const storyTagConfig = raw.storyTagConfig
    ? {
        order: raw.storyTagConfig.order,
        hidden: raw.storyTagConfig.hidden,
        labelOverrides: raw.storyTagConfig.labelOverrides,
      }
    : undefined;

  return {
    id: raw.id,
    label: raw.label,
    theme: raw.theme,
    status: raw.status,
    active: raw.active ?? false,
    startDate: raw.startDate,
    endDate: raw.endDate,
    branding,
    storyTagConfig,
    _startDate: startTimestamp,
    _endDate: endTimestamp,
  };
}

function readUpdateFilesFromDir(dirPath, label) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => {
    const fullPath = path.join(dirPath, fileName);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (error) {
      fail(`${label}/${fileName}: invalid JSON. ${error instanceof Error ? error.message : String(error)}`);
    }
    return validateUpdate(parsed, `${label}/${fileName}`);
  });
}

function readEditionFilesFromDir(dirPath, label) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  return files.map((fileName) => {
    const fullPath = path.join(dirPath, fileName);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    } catch (error) {
      fail(`${label}/${fileName}: invalid JSON. ${error instanceof Error ? error.message : String(error)}`);
    }
    return validateEdition(parsed, `${label}/${fileName}`);
  });
}

function validateTagLabelOverrides(raw, fileName) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail(`${fileName}: content must be a JSON object.`);
  }

  const result = {
    tags: {},
    storyTags: {},
    editionIds: {},
    editionThemes: {},
  };

  for (const field of ["tags", "storyTags", "editionIds", "editionThemes"]) {
    const fieldValue = raw[field];
    if (fieldValue === undefined) {
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object" || Array.isArray(fieldValue)) {
      fail(`${fileName}: ${field} must be an object map of kebab-case keys to non-empty labels.`);
    }

    for (const [key, value] of Object.entries(fieldValue)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
        fail(`${fileName}: ${field} key "${key}" must be kebab-case.`);
      }

      if (typeof value !== "string" || !value.trim()) {
        fail(`${fileName}: ${field}[${key}] must be a non-empty string.`);
      }

      result[field][key] = value.trim();
    }
  }

  return result;
}

function readTagLabelOverrides(filePath) {
  if (!fs.existsSync(filePath)) {
    return { tags: {}, storyTags: {}, editionIds: {}, editionThemes: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`content/tag-label-overrides.json: invalid JSON. ${error instanceof Error ? error.message : String(error)}`);
  }

  return validateTagLabelOverrides(parsed, "content/tag-label-overrides.json");
}

if (!fs.existsSync(manualUpdatesDir)) {
  fail(`Missing directory: ${manualUpdatesDir}`);
}

const updates = [
  ...readUpdateFilesFromDir(manualUpdatesDir, "content/updates"),
  ...readUpdateFilesFromDir(importedUpdatesDir, "content/imported-updates"),
];

const editions = readEditionFilesFromDir(editionsDir, "content/editions");
const tagLabelOverrides = readTagLabelOverrides(tagLabelOverridesFile);

if (!updates.length) {
  fail("No update content files found in content/updates or content/imported-updates.");
}

if (!editions.length) {
  fail("No edition content files found in content/editions.");
}

const idSet = new Set();
for (const update of updates) {
  if (idSet.has(update.id)) {
    fail(`Duplicate id detected: "${update.id}".`);
  }
  idSet.add(update.id);
}

const editionIdSet = new Set();
for (const edition of editions) {
  if (editionIdSet.has(edition.id)) {
    fail(`Duplicate edition id detected: "${edition.id}".`);
  }
  editionIdSet.add(edition.id);
}

const explicitlyActiveEditions = editions.filter((edition) => edition.active);
if (explicitlyActiveEditions.length > 1) {
  fail("Only one edition can have active=true.");
}

const now = Date.now();
const inferredActiveEdition =
  editions
    .filter((edition) => edition.status === "live" && edition._startDate <= now && now <= edition._endDate)
    .sort((a, b) => b._endDate - a._endDate)[0] ??
  editions.filter((edition) => edition.status === "live").sort((a, b) => b._endDate - a._endDate)[0] ??
  null;

const activeEditionId = explicitlyActiveEditions[0]?.id ?? inferredActiveEdition?.id ?? null;

updates.sort((a, b) => b._sortDate - a._sortDate);

for (const update of updates) {
  const normalizedEditionIds = update.editionIds?.filter(Boolean);

  if (normalizedEditionIds?.length) {
    const invalidEditionRefs = normalizedEditionIds.filter((editionId) => !editionIdSet.has(editionId));
    if (invalidEditionRefs.length) {
      fail(`Update "${update.id}" references unknown editionIds: ${invalidEditionRefs.join(", ")}.`);
    }
    update.editionIds = Array.from(new Set(normalizedEditionIds));
    continue;
  }

  const matchedEdition = editions
    .filter((edition) => edition._startDate <= update._sortDate && update._sortDate <= edition._endDate)
    .sort((a, b) => b._endDate - a._endDate)[0];

  if (matchedEdition) {
    update.editionIds = [matchedEdition.id];
  }
}

for (const update of updates) {
  delete update._sortDate;
}

for (const edition of editions) {
  delete edition._startDate;
  delete edition._endDate;
}

const output = `/* This file is auto-generated by scripts/generate-updates-content.mjs. */\nexport const updates = ${JSON.stringify(
  updates,
  null,
  2,
)};\n\nexport const editions = ${JSON.stringify(editions, null, 2)};\n\nexport const activeEditionId = ${JSON.stringify(activeEditionId)};\n\nexport const tagLabelOverrides = ${JSON.stringify(tagLabelOverrides, null, 2)};\n`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, output, "utf8");
console.log(`[content:generate] Wrote ${outputFile} (${updates.length} updates, ${editions.length} editions).`);
