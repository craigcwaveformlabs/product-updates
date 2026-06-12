"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  allTags,
  defaultHeroSlides,
  heroColorByStory,
  heroSlidesByStory,
  storyTagLabel,
  storyTags,
  tagLabel,
  updates,
} from "./content/updates";
import type { DetailBlock, ProductUpdate, StoryTag, UpdateTag } from "./content/updates";

function splitInlineFormattedText(text: string) {
  const matches = text.match(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  if (!matches) {
    return [
      {
        kind: "text" as const,
        value: text,
      },
    ];
  }

  const tokens: Array<{ kind: "text" | "bold" | "italic"; value: string }> = [];
  let cursor = 0;

  for (const match of matches) {
    const index = text.indexOf(match, cursor);
    if (index > cursor) {
      tokens.push({
        kind: "text",
        value: text.slice(cursor, index),
      });
    }

    if (match.startsWith("**") && match.endsWith("**") && match.length > 4) {
      tokens.push({
        kind: "bold",
        value: match.slice(2, -2),
      });
    } else if (match.startsWith("*") && match.endsWith("*") && match.length > 2) {
      tokens.push({
        kind: "italic",
        value: match.slice(1, -1),
      });
    } else {
      tokens.push({
        kind: "text",
        value: match,
      });
    }

    cursor = index + match.length;
  }

  if (cursor < text.length) {
    tokens.push({
      kind: "text",
      value: text.slice(cursor),
    });
  }

  return tokens;
}

function renderInlineFormattedText(text: string) {
  const tokens = splitInlineFormattedText(text);

  return tokens.map((token, index) => {
    if (token.kind === "bold") {
      return <strong key={`bold-${index}`}>{token.value}</strong>;
    }

    if (token.kind === "italic") {
      return <em key={`italic-${index}`}>{token.value}</em>;
    }

    return <Fragment key={`text-${index}`}>{token.value}</Fragment>;
  });
}

function detailBlocksForPreview(update: ProductUpdate): DetailBlock[] {
  if (update.detailBlocks?.length) {
    return update.detailBlocks;
  }

  if (update.detailBody?.length) {
    return update.detailBody.map((text) => ({
      type: "body" as const,
      text,
    }));
  }

  return [
    {
      type: "body",
      text: update.summaryBody,
    },
  ];
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export default function Page() {
  const [selectedTags, setSelectedTags] = useState<UpdateTag[]>([]);
  const [selectedStoryTag, setSelectedStoryTag] = useState<StoryTag | null>(null);
  const [selectedUpdate, setSelectedUpdate] = useState<ProductUpdate | null>(null);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  const filteredUpdates = useMemo(() => {
    const filtered = updates.filter((update) => {
      const hasStory = selectedStoryTag ? update.storyTags.includes(selectedStoryTag) : true;
      const hasTags = selectedTags.length ? selectedTags.every((tag) => update.tags.includes(tag)) : true;
      return hasStory && hasTags;
    });

    // Sort: pinned updates first (story-specific when selected, default pins otherwise), then by date
    return filtered.sort((a, b) => {
      if (selectedStoryTag) {
        const aPinned = a.pinnedForStories?.includes(selectedStoryTag) ?? false;
        const bPinned = b.pinnedForStories?.includes(selectedStoryTag) ?? false;
        if (aPinned !== bPinned) return bPinned ? 1 : -1;
      } else {
        const aPinnedDefault = a.pinInDefaultView ?? false;
        const bPinnedDefault = b.pinInDefaultView ?? false;
        if (aPinnedDefault !== bPinnedDefault) return bPinnedDefault ? 1 : -1;
      }
      return Date.parse(b.date) - Date.parse(a.date);
    });
  }, [selectedStoryTag, selectedTags]);

  const previewUpdate = selectedUpdate;
  const activeHeroSlides = selectedStoryTag ? (heroSlidesByStory[selectedStoryTag] ?? []) : defaultHeroSlides;
  const normalizedHeroImageIndex = activeHeroSlides.length
    ? ((heroImageIndex % activeHeroSlides.length) + activeHeroSlides.length) % activeHeroSlides.length
    : 0;
  const activeHeroSlide = activeHeroSlides.length ? activeHeroSlides[normalizedHeroImageIndex] : null;
  const activeHero = activeHeroSlide || defaultHeroSlides[0];
  const hasHeroCarousel = activeHeroSlides.length > 1;
  const activeHeroBackgroundColor = selectedStoryTag
    ? (heroColorByStory[selectedStoryTag] ?? "#008cff")
    : "#008cff";
  const isDefaultHero = !selectedStoryTag;

  useEffect(() => {
    if (selectedUpdate && !filteredUpdates.some((item) => item.id === selectedUpdate.id)) {
      setSelectedUpdate(null);
    }
  }, [filteredUpdates, selectedUpdate]);

  useEffect(() => {
    setHeroImageIndex(0);
  }, [selectedStoryTag]);

  const toggleTag = (tag: UpdateTag) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const selectStoryTag = (tag: StoryTag) => {
    setSelectedStoryTag((current) => (current === tag ? null : tag));
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedStoryTag(null);
  };

  return (
    <div className="brand-shell min-h-screen pb-12">
      <div className="mt-6 flex w-full flex-col gap-6 px-3 sm:px-4 lg:px-6 lg:flex-row lg:items-start">
        <div className="top-6 w-full lg:sticky lg:w-[305px] lg:shrink-0">
          <aside className="brand-panel rounded-2xl p-5">
            <h2 className="text-base font-extrabold text-zinc-900">Filter updates</h2>
            <p className="mt-1 text-sm text-[#4e6378]">Refine by story and topic tags.</p>

            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Story tags</h3>
              <div role="radiogroup" aria-label="Story tag filter" className="mt-2 flex flex-col gap-2">
                {storyTags.map((tag) => {
                  const selected = selectedStoryTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectStoryTag(tag)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d8fdb] focus-visible:ring-offset-2 ${
                        selected
                          ? "border-[#2461b8] bg-[#2461b8] text-white"
                          : "border-[#c5d5e8] bg-white text-zinc-800 hover:border-[#2461b8]"
                      }`}
                    >
                      {storyTagLabel[tag]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Topic tags</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d8fdb] focus-visible:ring-offset-2 ${
                        active
                          ? "border-[#2461b8] bg-[#2461b8] text-white"
                          : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#2461b8]"
                      }`}
                      aria-pressed={active}
                    >
                      {tagLabel[tag]}
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-[#1a4a96] underline decoration-[#a8c8f0] underline-offset-4 hover:decoration-[#1a4a96]"
              >
                Clear all
              </button>
              <span className="rounded-full bg-[#e0edfa] px-2.5 py-1 text-xs font-extrabold text-[#1a2e44]">
                {filteredUpdates.length} shown
              </span>
            </div>
          </aside>

          <section className="brand-panel mt-4 rounded-2xl p-4">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-zinc-700">Content tools</h3>
            <p className="mt-1 text-sm text-[#4e6378]">Create and edit update content from the studio.</p>
            <Link
              href="/content-studio"
              className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-[#c5d5e8] bg-white px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#1a2e44] transition hover:border-[#2461b8]"
            >
              Open content studio
            </Link>
          </section>
        </div>

        <main className="w-full space-y-5">
          <div>
            <section
              className="brand-hero relative overflow-hidden rounded-2xl p-5 sm:p-7"
              style={{ backgroundColor: activeHeroBackgroundColor }}
            >
              <div className="relative z-10 grid h-full grid-cols-1 items-center gap-5 md:grid-cols-[1.15fr_0.85fr] md:gap-6">
              <div className="max-w-2xl">
                <p className={`text-xs font-extrabold uppercase tracking-[0.18em] ${isDefaultHero ? "text-white/90" : "text-[#0f2e6e]"}`}>
                  {activeHero.eyebrow}
                </p>
                <h1 className={`title-font mt-2 text-3xl font-extrabold tracking-tight ${isDefaultHero ? "text-white" : "text-zinc-950"} sm:text-4xl`}>
                  {activeHero.title}
                </h1>
                <p className={`mt-3 text-base leading-7 ${isDefaultHero ? "text-white/90" : "text-[#2f4a67]"}`}>{activeHero.body}</p>
                {isExternalUrl(activeHero.readMoreUrl) ? (
                  <a
                    href={activeHero.readMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex rounded-full bg-[#1a2e44] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#102338]"
                  >
                    Read more
                  </a>
                ) : (
                  <Link
                    href={activeHero.readMoreUrl}
                    className="mt-4 inline-flex rounded-full bg-[#1a2e44] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#102338]"
                  >
                    Read more
                  </Link>
                )}
              </div>

              {activeHero.imageSrc ? (
                <div className="relative h-[240px] w-[380px] max-w-full shrink-0 overflow-hidden rounded-xl bg-white/35">
                  <Image
                    src={activeHero.imageSrc}
                    alt={activeHero.imageAlt}
                    fill
                    unoptimized
                    priority
                    sizes="(min-width: 1024px) 360px, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              </div>
            </section>

            {hasHeroCarousel ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  aria-label="Previous hero slide"
                  onClick={() => setHeroImageIndex((index) => index - 1)}
                  className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-sm font-bold text-[#1a2e44] transition hover:border-[#2461b8] hover:bg-[#f3f6fa]"
                >
                  Prev
                </button>
                <span className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-xs font-extrabold text-[#1a2e44]">
                  {normalizedHeroImageIndex + 1}/{activeHeroSlides.length}
                </span>
                <button
                  type="button"
                  aria-label="Next hero slide"
                  onClick={() => setHeroImageIndex((index) => index + 1)}
                  className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-sm font-bold text-[#1a2e44] transition hover:border-[#2461b8] hover:bg-[#f3f6fa]"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>

          <section aria-label="Product updates" className="flex flex-wrap gap-4">
            {filteredUpdates.map((update) => (
              <article key={update.id} className="brand-panel flex w-full flex-col overflow-hidden rounded-2xl p-4 sm:w-[360px]">
                <Image
                  src={update.imageSrc}
                  alt={update.imageAlt}
                  width={800}
                  height={420}
                  className="h-44 w-full rounded-xl object-cover"
                />

                <h2 className="title-font card-title mt-3 text-xl font-extrabold leading-7 text-zinc-950">{update.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#4e6378]">{update.summaryBody}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {update.storyTags.map((storyTag) => (
                    <span
                      key={`${update.id}-${storyTag}`}
                      className="rounded-full bg-[#1a2e44] px-2.5 py-1 text-xs font-bold text-white"
                    >
                      {storyTagLabel[storyTag]}
                    </span>
                  ))}
                  {update.tags.map((tag) => (
                    <span
                      key={`${update.id}-${tag}`}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${tag === "coming-soon" ? "bg-[#008cffff] text-white" : "bg-[#dceeff] text-[#1a4896]"}`}
                    >
                      {tagLabel[tag]}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-4 pt-5">
                  <button
                    type="button"
                    onClick={() => setSelectedUpdate(update)}
                    className="rounded-full border border-[#c5d5e8] bg-white px-4 py-2 text-sm font-bold text-zinc-800 transition hover:border-[#2461b8]"
                  >
                    Read more
                  </button>
                </div>
              </article>
            ))}
          </section>

          {filteredUpdates.length === 0 ? (
            <section className="brand-panel rounded-2xl p-8 text-center">
              <h2 className="title-font text-xl font-extrabold text-zinc-950">No updates match your filters</h2>
              <p className="mt-2 text-[#4e6378]">Try removing one or more tags to see the full stream.</p>
            </section>
          ) : null}
        </main>
      </div>

      {previewUpdate ? (
        <>
          <button
            type="button"
            aria-label="Close preview"
            className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-[1px]"
            onClick={() => setSelectedUpdate(null)}
          />
          <aside
            className="fixed inset-0 z-50 overflow-y-auto bg-white/98 p-6 shadow-2xl sm:p-8"
            aria-label="Update preview"
          >
            <div className="mx-auto w-full max-w-5xl">
              <div className="sticky top-0 z-10 -mx-2 mb-4 flex justify-end bg-white/90 px-2 py-2 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setSelectedUpdate(null)}
                  className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1 text-sm font-bold text-zinc-800 hover:border-[#2461b8]"
                >
                  Close
                </button>
              </div>
              <Image
                src={previewUpdate.imageSrc}
                alt={previewUpdate.imageAlt}
                width={1200}
                height={630}
                unoptimized
                className="mt-4 w-full rounded-xl object-contain"
              />
              {!previewUpdate.tags.includes("coming-soon") ? (
                <p className="meta-date mt-3 text-sm font-semibold">{previewUpdate.date}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {previewUpdate.storyTags.map((storyTag) => (
                  <span
                    key={`drawer-story-${previewUpdate.id}-${storyTag}`}
                    className="rounded-full bg-[#1a2e44] px-2.5 py-1 text-xs font-bold text-white"
                  >
                    {storyTagLabel[storyTag]}
                  </span>
                ))}
                {previewUpdate.tags.map((tag) => (
                  <span
                    key={`drawer-topic-${previewUpdate.id}-${tag}`}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${tag === "coming-soon" ? "bg-[#008cffff] text-white" : "bg-[#dceeff] text-[#1a4896]"}`}
                  >
                    {tagLabel[tag]}
                  </span>
                ))}
              </div>

              <h2 className="title-font mt-4 text-2xl font-extrabold leading-8 text-zinc-950">{previewUpdate.title}</h2>
              <div className="mt-3 space-y-4 text-lg leading-8 text-[#4e6378]">
                {detailBlocksForPreview(previewUpdate).map((block, index) => {
                  if (block.type === "heading-lg") {
                    return (
                      <h3
                        key={`preview-block-${previewUpdate.id}-${index}`}
                        className="title-font text-2xl font-extrabold leading-8 text-zinc-950"
                      >
                        {renderInlineFormattedText(block.text)}
                      </h3>
                    );
                  }

                  if (block.type === "heading-sm") {
                    return (
                      <h4
                        key={`preview-block-${previewUpdate.id}-${index}`}
                        className="title-font text-xl font-extrabold leading-7 text-zinc-900"
                      >
                        {renderInlineFormattedText(block.text)}
                      </h4>
                    );
                  }

                  return (
                    <p key={`preview-block-${previewUpdate.id}-${index}`}>{renderInlineFormattedText(block.text)}</p>
                  );
                })}
              </div>
              <a
                href={previewUpdate.readMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex rounded-full bg-[#1a4a96] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#2461b8]"
              >
                Read on FreeAgent blog
              </a>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
