import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`[content:new] ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  let id = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--id=")) {
      id = arg.slice("--id=".length).trim();
      continue;
    }
    if (arg === "--id") {
      id = (argv[i + 1] ?? "").trim();
      i += 1;
    }
  }

  return { id };
}

function isKebabCase(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function toTitleFromId(id) {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.toLocaleString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

const { id } = parseArgs(process.argv.slice(2));
if (!id) {
  fail("Missing required argument --id. Example: npm run content:new -- --id cashflow-forecasting");
}

if (!isKebabCase(id)) {
  fail("--id must be kebab-case (lowercase letters, numbers, and hyphens only).");
}

const root = process.cwd();
const updatesDir = path.join(root, "content", "updates");
const outputFile = path.join(updatesDir, `${id}.json`);

if (!fs.existsSync(updatesDir)) {
  fail(`Missing directory: ${updatesDir}`);
}

if (fs.existsSync(outputFile)) {
  fail(`File already exists: ${path.relative(root, outputFile)}`);
}

const today = formatDate(new Date());
const title = toTitleFromId(id);

const template = {
  id,
  imageSrc: "/updates/update-image.svg",
  imageAlt: `${title} preview`,
  date: today,
  tags: [],
  storyTags: [],
  title,
  summaryBody: "Add a one-sentence summary for the card grid.",
  detailBody: [
    "Add the first preview paragraph.",
    "Add the second preview paragraph.",
  ],
  readMoreUrl: "https://www.freeagent.com/blog/",
};

fs.writeFileSync(outputFile, `${JSON.stringify(template, null, 2)}\n`, "utf8");
console.log(`[content:new] Created ${path.relative(root, outputFile)}`);
console.log("[content:new] Next steps:");
console.log("  1) Fill in tags, storyTags, summaryBody, detailBody, and image fields.");
console.log("  2) Run npm run content:generate");
