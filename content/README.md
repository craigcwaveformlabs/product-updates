# Product Update Content

Each product update is stored as one JSON file in `content/updates/`.

For the full workflow guide, see `docs/content-authoring-guide.md`.

## Required fields

- `id` (string, unique)
- `imageSrc` (string)
- `imageAlt` (string)
- `date` (string, parseable date like `4 May 2026`)
- `tags` (string[])
- `storyTags` (string[])
- `title` (string)
- `summaryBody` (string)
- `readMoreUrl` (string)

## Optional fields

- `detailBody` (string[]): multi-paragraph preview content.

## Create a new update file

Run:

```bash
npm run content:new -- --id your-update-id
```

This creates `content/updates/your-update-id.json` from a template.

## Generate typed app data

Run:

```bash
npm run content:generate
```

This validates all content files and writes:

- `app/content/generated/updates.generated.ts`

`npm run dev` and `npm run build` run this automatically.
