This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Content Studio Access

The Content Studio is available at `/content-studio`.

In local development:

- the Content Studio link is visible on the homepage
- the studio is accessible without credentials by default

In production:

- the homepage link is hidden
- `/content-studio` and `/api/content/*` are protected with HTTP Basic Auth
- if credentials are not configured, those routes return `404`

Set these environment variables in your deployment to enable access:

```env
CONTENT_STUDIO_USERNAME=your-username
CONTENT_STUDIO_PASSWORD=your-strong-password
```

When those variables are set, visiting `/content-studio` will prompt for the username and password.

## Viewer-only Static Build (GitHub Pages)

This repository includes a viewer-only static mode suitable for GitHub Pages.

### Build locally

```bash
npm run build:static
```

Static output is generated in `out/`.

The static build script temporarily excludes server-only routes (`app/api/*`) and proxy auth (`proxy.ts`) during export, then restores them automatically.

### What is included

- public updates viewer pages
- static update detail pages (`/updates/[id]`)

### What is excluded

- Content Studio editing functionality
- API route functionality (`/api/content/*`)

### Deploy from GitHub Actions

A workflow is provided at `.github/workflows/deploy-static-viewer.yml`.

1. In GitHub repo settings, enable Pages and set source to GitHub Actions.
2. Push to `main` (or run the workflow manually) to publish the static viewer.

## Editing Content

You can start editing the main experience by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [the Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Project Docs

- Implementation spec: [docs/implementation-spec.md](docs/implementation-spec.md)
