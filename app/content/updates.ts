import { updates as generatedUpdates } from "./generated/updates.generated";

// Content editing checklist:
// 1) Product card content: edit files in content/updates/*.json.
// 2) Regenerate content: run `npm run content:generate`.
// 3) Hero slides/copy/images by story: edit `heroSlidesByStory`.
// 4) Hero solid background colors by story: edit `heroColorByStory`.
// 5) Hero slides when no story tag is selected: edit `defaultHeroSlides`.
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
  pinInDefaultView?: boolean;
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

export const tagLabel: Record<UpdateTag, string> = Object.fromEntries(
  allTags.map((tag) => [tag, slugToLabel(tag)]),
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
      readMoreUrl: "https://www.freeagent.com/blog/?s=tax",
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
  "the-freeagent-story": [
    {
      imageSrc: "/hero/hero_4a.png",
      imageAlt: "The FreeAgent Story hero",
      eyebrow: "Story: The FreeAgent Story",
      title: "Accounting software for every small business",
      body: "We've come a long long way together. Find out where FreeAgent are today and how we are helping every UK business stay in control of their finances.",
      readMoreUrl: "https://www.freeagent.com/",
    },
  ],
};

// Solid hero background color per selected story tag.
export const heroColorByStory: Record<string, string> = {
  "be-tax-confident": "#ffe238",
  "built-for-every-business": "#78b9f9",
  "transformative-accounting": "#06dbba",
  "the-freeagent-story": "#008cffff",
};

const preferredStoryTagOrder: StoryTag[] = [
  "be-tax-confident",
  "built-for-every-business",
  "transformative-accounting",
  "the-freeagent-story",
];

const discoveredStoryTags = Array.from(
  new Set([...updates.flatMap((update) => update.storyTags), ...Object.keys(heroSlidesByStory)]),
);

export const storyTags = [
  ...preferredStoryTagOrder.filter((tag) => discoveredStoryTags.includes(tag)),
  ...discoveredStoryTags.filter((tag) => !preferredStoryTagOrder.includes(tag)).sort(),
];

const storyTagLabelOverrides: Partial<Record<StoryTag, string>> = {
  "the-freeagent-story": "The FreeAgent Story",
};

export const storyTagLabel: Record<StoryTag, string> = Object.fromEntries(
  storyTags.map((tag) => [tag, storyTagLabelOverrides[tag] ?? slugToLabel(tag)]),
);

// Default hero shown when no story tag is selected.
export const defaultHeroSlides: HeroSlide[] = [
  {
    imageSrc: "/hero/hero_0a.png",
    imageAlt: "Default product updates hero",
    eyebrow: "Showcase",
    title: "The FreeAgent Showcase",
    body: "Browse the newest improvements across bookkeeping, compliance, and admin workflows. Join us at our upcoming roadshows to hear about how FreeAgent can help your Practice.",
    readMoreUrl: "https://www.freeagent.com/blog/",
  },
  {
    imageSrc: "/hero/hero_0b.png",
    imageAlt: "Get MTD done",
    eyebrow: "Showcase",
    title: "Get MTD done",
    body: "FreeAgent’s powerful, MTD-ready accounting solution streamlines your processes and frees up your time so you can focus on the expert advice your clients rely on.",
    readMoreUrl: "https://www.freeagent.com/blog/product-spotlight-april-2026/",
  },
  {
    imageSrc: "/hero/hero_0c.png",
    imageAlt: "The FreeAgent Story",
    eyebrow: "Showcase",
    title: "The FreeAgent Story",
    body: "We've come a long long way together. Find out where FreeAgent are today and how we are helping every UK business stay in control of their finances",
    readMoreUrl: "https://www.freeagent.com/blog/product-spotlight-april-2026/",
  },
];
