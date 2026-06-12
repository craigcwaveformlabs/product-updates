import { updates as generatedUpdates } from "./generated/updates.generated";

// Content editing checklist:
// 1) Product card content: edit files in content/updates/*.json.
// 2) Regenerate content: run `npm run content:generate`.
// 3) Hero slides/copy/images by story: edit `heroSlidesByStory`.
// 4) Hero solid background colors by story: edit `heroColorByStory`.
// 5) Hero when no story tag is selected: edit `defaultHero`.
// 6) Tag display text in UI is generated from tag slugs.
export type UpdateTag = string;
export type StoryTag = string;
export type DetailBlockType = "body" | "heading-lg" | "heading-sm";

export type DetailBlock = {
  type: DetailBlockType;
  text: string;
};

export type ProductUpdate = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  date: string;
  tags: UpdateTag[];
  storyTags: StoryTag[];
  title: string;
  summaryBody: string;
  detailBody?: string[];
  detailBlocks?: DetailBlock[];
  readMoreUrl: string;
  pinnedForStories?: string[];
};

export type HeroSlide = {
  imageSrc: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  body: string;
  readMoreUrl: string;
};

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Product updates are generated from content/updates/*.json.
export const updates: ProductUpdate[] = generatedUpdates as ProductUpdate[];

export const allTags = Array.from(new Set(updates.flatMap((update) => update.tags))).sort();
export const storyTags = Array.from(new Set(updates.flatMap((update) => update.storyTags))).sort();

export const tagLabel: Record<UpdateTag, string> = Object.fromEntries(
  allTags.map((tag) => [tag, slugToLabel(tag)]),
);

export const storyTagLabel: Record<StoryTag, string> = Object.fromEntries(
  storyTags.map((tag) => [tag, slugToLabel(tag)]),
);

// Hero carousel content per story tag.
// Add more slides (e.g. 1e, 1f) by appending items in the relevant array.
export const heroSlidesByStory: Record<string, HeroSlide[]> = {
  "be-tax-confident": [
    {
      imageSrc: "/hero/hero_1a.png",
      imageAlt: "Tax confidence hero scene one",
      eyebrow: "Story: Be tax confident",
      title: "Compliant books, ready to file",
      body: "Accurate records you can rely on - and HMRC recognised filing built in from day one",
    },
  ],
  "built-for-every-business": [
    {
      imageSrc: "/hero/hero_2a.png",
      imageAlt: "Built for every business hero",
      eyebrow: "Story: Built for every business",
      title: "Control, without the complexity",
      body: "Financial confidence for all UK businesses - and the experts who power them.",
      readMoreUrl: "https://www.freeagent.com/blog/?s=small+business",
    },
  ],
  "transformative-accounting": [
    {
      imageSrc: "/hero/hero_3a.png",
      imageAlt: "Transformative accounting hero",
      eyebrow: "Story: Transformative accounting",
      title: "More business, less admin",
      body: "Swap manual tasks for effortless automation and build a business that is ready for anything.",
      readMoreUrl: "https://www.freeagent.com/blog/?s=automation",
    },
  ],
};

// Solid hero background color per selected story tag.
export const heroColorByStory: Record<string, string> = {
  "be-tax-confident": "#ffe238",
  "built-for-every-business": "#78b9f9",
  "transformative-accounting": "#06dbba",
};

// Default hero shown when no story tag is selected.
export const defaultHero: HeroSlide = {
  imageSrc: "/hero/hero_0a.png",
  imageAlt: "Default product updates hero",
  eyebrow: "Showcase",
  title: "Welcome to the FreeAgent Showcase",
  body: "Browse the newest improvements across bookkeeping, compliance, and advisor workflows.",
  readMoreUrl: "https://www.freeagent.com/blog/",
};
