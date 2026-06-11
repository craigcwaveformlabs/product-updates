# Product Updates Content Authoring Guide

This guide explains how to create, validate, and publish new Product Update cards using the file-based content system.

## One-Minute Quick Reference

Use this when you just need the commands:

```bash
# 1) scaffold a new update file
npm run content:new -- --id your-update-id

# 2) edit content/updates/your-update-id.json

# 3) validate and generate typed app data
npm run content:generate

# 4) preview locally
npm run dev
```

Fast checks before commit:
- `id` is unique and kebab-case.
- `summaryBody` is one concise sentence.
- `detailBody` is optional but should be paragraph-based when present.
- `tags` and `storyTags` use allowed values.
- `imageSrc` points to an existing asset.


## Overview

Content now lives in one file per update under the content/updates folder.

The app reads generated data from app/content/generated/updates.generated.ts.

You should not manually edit the generated file.

## Quick Start

1. Create a new update file from template.
2. Fill in the required fields.
3. Validate and generate app data.
4. Preview locally.

## 1) Create a New Update File

Run this from the repo root:

```bash
npm run content:new -- --id your-update-id
```

Example:

```bash
npm run content:new -- --id automated-vat-warnings
```

Rules for id:
- Must be kebab-case.
- Must be unique.
- Use a stable, descriptive slug.

This command creates:
- content/updates/your-update-id.json

## 2) Fill in the Update Content

Open the new JSON file and complete fields.

Required fields:
- id
- imageSrc
- imageAlt
- date
- tags
- storyTags
- title
- summaryBody
- readMoreUrl

Optional fields:
- detailBody

Field guidance:
- summaryBody: one short sentence used on the grid card.
- detailBody: paragraph array used in the full-screen preview.
- If detailBody is omitted, preview falls back to summaryBody.

Date guidance:
- Use a parseable format such as 11 Jun 2026.

Tag constraints:
- tags and storyTags are validated against known allowed values.
- Unknown values fail generation.

## 3) Generate and Validate Content

Run:

```bash
npm run content:generate
```

What this does:
- Reads all JSON files in content/updates.
- Validates schema and required fields.
- Validates allowed tag values.
- Validates unique ids.
- Sorts updates by date descending.
- Writes app/content/generated/updates.generated.ts.

## 4) Preview in the App

Run dev server:

```bash
npm run dev
```

Generation runs automatically before dev and build because predev and prebuild are configured.

## Content Writing Checklist

Before opening a PR:
- Confirm summaryBody is concise and clear.
- Confirm detailBody reads as natural multi-paragraph copy.
- Confirm imageSrc points to an existing asset.
- Confirm tags and storyTags are valid and intentional.
- Confirm date ordering appears as expected in the UI.

## Common Errors and Fixes

Error: missing required argument --id
- Fix: pass an id, for example npm run content:new -- --id bank-rules-update

Error: id must be kebab-case
- Fix: convert to lowercase words separated by hyphens.

Error: file already exists
- Fix: choose a different id or edit the existing file.

Error: unknown tags or storyTags
- Fix: use allowed values defined in app/content/updates.ts.

Error: date is not parseable
- Fix: use a clear format such as 11 Jun 2026.

## Recommended Team Workflow

1. Create one content file per change.
2. Keep copy edits isolated to content files when possible.
3. Run content generation before committing.
4. Include screenshots in PRs when copy or ordering changes.

## Future Automation Ideas

- Add content:check script that validates without writing output.
- Add image linting to verify referenced assets exist.
- Add AI-assisted draft generation command for summary and detail copy.
