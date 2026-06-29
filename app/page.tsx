"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  activeEditionId,
  allTags,
  defaultHeroSlides,
  editions,
  heroColorByStory,
  heroSlidesByStory,
  tagLabel,
  storyTagLabel,
  storyTags,
  updates,
} from "./content/updates";
import type { DetailBlock, ProductUpdate, StoryTag, UpdateTag } from "./content/updates";

const ROADMAP_TAG = "roadmap";

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

const readableDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatReadableDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return readableDateFormatter.format(new Date(parsed));
}

const roadmapMonthHeaderFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});

const roadmapMonthRailFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
});

const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isViewerOnly = process.env.NEXT_PUBLIC_VIEWER_ONLY === "true";

function withPublicBasePath(src: string): string {
  if (!src.startsWith("/")) {
    return src;
  }

  if (!publicBasePath) {
    return src;
  }

  return `${publicBasePath}${src}`;
}

function tagBadgeClass(tag: UpdateTag): string {
  if (tag === "coming-soon") {
    return "bg-[#008cffff] text-white";
  }

  if (tag.startsWith("roadmap-status-proposal")) {
    return "bg-[#f8d7ea] text-[#8a2a5a]";
  }

  if (tag.startsWith("roadmap-status-backlog")) {
    return "bg-[#d9ecff] text-[#1f5d8f]";
  }

  if (tag.startsWith("roadmap-status-define")) {
    return "bg-[#fff3c9] text-[#7a5a00]";
  }

  if (tag.startsWith("roadmap-status-build")) {
    return "bg-[#eadcc8] text-[#6e4b2e]";
  }

  if (tag.startsWith("roadmap-status-done")) {
    return "bg-[#d8f2de] text-[#1f6a3a]";
  }

  if (tag === ROADMAP_TAG || tag.startsWith("roadmap-")) {
    return "bg-[#1a2e44] text-white";
  }

  return "bg-[#dceeff] text-[#1a4896]";
}

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedTags, setSelectedTags] = useState<UpdateTag[]>([]);
  const [selectedStoryTag, setSelectedStoryTag] = useState<StoryTag | null>(null);
  const [showRoadmapOnly, setShowRoadmapOnly] = useState(false);
  const [selectedRoadmapTag, setSelectedRoadmapTag] = useState<UpdateTag | null>(null);
  const [selectedRoadmapMonth, setSelectedRoadmapMonth] = useState<string | null>(null);
  const [roadmapTimeScope, setRoadmapTimeScope] = useState<"future" | "past">("future");
  const [roadmapMonthRailStartIndex, setRoadmapMonthRailStartIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUpdate, setSelectedUpdate] = useState<ProductUpdate | null>(null);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  const editionOptions = useMemo(() => editions, []);

  const defaultEditionId = useMemo(() => {
    const activeEditionKey = activeEditionId;
    const activeEditionHasContent = activeEditionKey
      ? updates.some((update) => update.editionIds?.includes(activeEditionKey))
      : false;

    if (activeEditionHasContent) {
      return activeEditionKey;
    }

    return editions.find((edition) => updates.some((update) => update.editionIds?.includes(edition.id)))?.id ?? null;
  }, []);

  const [selectedEditionId, setSelectedEditionId] = useState<string | null>(defaultEditionId);

  const selectedEdition = useMemo(
    () => editionOptions.find((edition) => edition.id === selectedEditionId) ?? null,
    [editionOptions, selectedEditionId],
  );

  const roadmapTagOptions = useMemo(
    () => allTags.filter((tag) => tag.startsWith("roadmap-")).sort(),
    [],
  );

  const contentTagOptions = useMemo(
    () => allTags.filter((tag) => tag !== ROADMAP_TAG && !tag.startsWith("roadmap-")).sort(),
    [],
  );

  const roadmapUpdates = useMemo(
    () =>
      updates.filter(
        (update) =>
          update.tags.includes(ROADMAP_TAG) &&
          (selectedEditionId ? (update.editionIds?.includes(selectedEditionId) ?? false) : true),
      ),
    [selectedEditionId],
  );

  const filteredUpdates = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const filtered = updates.filter((update) => {
      const hasStory = selectedStoryTag ? update.storyTags.includes(selectedStoryTag) : true;
      const hasEdition = selectedEditionId ? (update.editionIds?.includes(selectedEditionId) ?? false) : true;
      const hasTopicTags = selectedTags.length ? selectedTags.every((tag) => update.tags.includes(tag)) : true;
      const matchesRoadmapOnly = showRoadmapOnly ? update.tags.includes(ROADMAP_TAG) : true;
      const matchesRoadmapTag = selectedRoadmapTag ? update.tags.includes(selectedRoadmapTag) : true;
      const searchableText = [
        update.id,
        update.title,
        update.summaryBody,
        update.date,
        ...update.tags,
        ...update.storyTags,
        ...(update.detailBody ?? []),
        ...(update.detailBlocks?.map((block) => block.text) ?? []),
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = normalizedSearch ? searchableText.includes(normalizedSearch) : true;
      return hasStory && hasEdition && hasTopicTags && matchesRoadmapOnly && matchesRoadmapTag && matchesSearch;
    });

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
  }, [searchQuery, selectedEditionId, selectedRoadmapTag, selectedStoryTag, selectedTags, showRoadmapOnly]);

  const visibleRoadmapUpdates = useMemo(
    () => filteredUpdates.filter((update) => update.tags.includes(ROADMAP_TAG)),
    [filteredUpdates],
  );

  const roadmapComingSoonCount = useMemo(
    () => roadmapUpdates.filter((update) => update.tags.includes("coming-soon")).length,
    [roadmapUpdates],
  );

  const todayIso = useMemo(() => {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  }, []);
  const currentRoadmapMonthKey = todayIso.slice(0, 7);

  const scopedRoadmapUpdates = useMemo(
    () =>
      visibleRoadmapUpdates.filter((update) => {
        const isDone = update.tags.includes("roadmap-status-done") || update.tags.includes("done");

        if (roadmapTimeScope === "past") {
          return isDone;
        }

        if (isDone) {
          return false;
        }

        const parsed = Date.parse(update.date);
        if (Number.isNaN(parsed)) {
          return true;
        }

        const updateIso = new Date(parsed).toISOString().slice(0, 10);
        return updateIso >= todayIso;
      }),
    [roadmapTimeScope, todayIso, visibleRoadmapUpdates],
  );

  const roadmapScopeCounts = useMemo(() => {
    let past = 0;
    let future = 0;

    for (const update of visibleRoadmapUpdates) {
      const isDone = update.tags.includes("roadmap-status-done") || update.tags.includes("done");
      if (isDone) {
        past += 1;
      } else {
        future += 1;
      }
    }

    return { past, future };
  }, [visibleRoadmapUpdates]);

  const roadmapUpdatesByMonth = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: ProductUpdate[] }> = [];
    const byKey = new Map<string, { key: string; label: string; items: ProductUpdate[] }>();

    for (const update of scopedRoadmapUpdates) {
      const parsed = Date.parse(update.date);
      const dateValue = Number.isNaN(parsed) ? null : new Date(parsed);
      const key = dateValue ? dateValue.toISOString().slice(0, 7) : "unknown";
      const label = dateValue ? roadmapMonthHeaderFormatter.format(dateValue) : "No date";

      let group = byKey.get(key);
      if (!group) {
        group = { key, label, items: [] };
        byKey.set(key, group);
        groups.push(group);
      }

      group.items.push(update);
    }

    groups.sort((a, b) => {
      if (a.key === "unknown") return 1;
      if (b.key === "unknown") return -1;
      return roadmapTimeScope === "future" ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
    });

    return groups;
  }, [scopedRoadmapUpdates]);

  const roadmapMonthOptions = useMemo(
    () => roadmapUpdatesByMonth.map((group) => ({ key: group.key, label: group.label, count: group.items.length })),
    [roadmapUpdatesByMonth],
  );

  const roadmapMonthRailWindowSize = 6;

  const roadmapMonthRailNodes = useMemo(
    () => [
      {
        key: null as string | null,
        label: "All months",
        compactLabel: "All",
        count: scopedRoadmapUpdates.length,
        isCurrentMonth: false,
      },
      ...roadmapMonthOptions.map((month) => {
        const parsedMonth =
          month.key === "unknown" ? Number.NaN : Date.parse(`${month.key}-01T00:00:00.000Z`);
        const compactLabel = Number.isNaN(parsedMonth)
          ? month.label
          : roadmapMonthRailFormatter.format(new Date(parsedMonth));

        return {
          key: month.key,
          label: month.label,
          compactLabel,
          count: month.count,
          isCurrentMonth: month.key === currentRoadmapMonthKey,
        };
      }),
    ],
    [currentRoadmapMonthKey, roadmapMonthOptions, scopedRoadmapUpdates.length],
  );

  const maxRoadmapMonthRailStart = Math.max(0, roadmapMonthRailNodes.length - roadmapMonthRailWindowSize);

  const visibleRoadmapMonthRailNodes = useMemo(
    () =>
      roadmapMonthRailNodes.slice(
        roadmapMonthRailStartIndex,
        roadmapMonthRailStartIndex + roadmapMonthRailWindowSize,
      ),
    [roadmapMonthRailNodes, roadmapMonthRailStartIndex],
  );

  const selectedRoadmapMonthRailFocusKey = useMemo(() => {
    if (selectedRoadmapMonth) {
      return selectedRoadmapMonth;
    }

    return roadmapMonthOptions.some((month) => month.key === currentRoadmapMonthKey)
      ? currentRoadmapMonthKey
      : null;
  }, [currentRoadmapMonthKey, roadmapMonthOptions, selectedRoadmapMonth]);

  const canShiftRoadmapMonthRailBack = roadmapMonthRailStartIndex > 0;
  const canShiftRoadmapMonthRailForward = roadmapMonthRailStartIndex < maxRoadmapMonthRailStart;

  const visibleRoadmapUpdatesByMonth = useMemo(
    () =>
      selectedRoadmapMonth
        ? roadmapUpdatesByMonth.filter((group) => group.key === selectedRoadmapMonth)
        : roadmapUpdatesByMonth,
    [roadmapUpdatesByMonth, selectedRoadmapMonth],
  );

  const previewUpdate = selectedUpdate;
  const isRoadmapPanelActive = showRoadmapOnly || selectedRoadmapTag !== null;
  const activeHeroSlides = selectedStoryTag ? (heroSlidesByStory[selectedStoryTag] ?? []) : defaultHeroSlides;
  const normalizedHeroImageIndex = activeHeroSlides.length
    ? ((heroImageIndex % activeHeroSlides.length) + activeHeroSlides.length) % activeHeroSlides.length
    : 0;
  const activeHeroSlide = activeHeroSlides.length ? activeHeroSlides[normalizedHeroImageIndex] : null;
  const activeHero = activeHeroSlide || defaultHeroSlides[0];
  const hasHeroCarousel = activeHeroSlides.length > 1;
  const activeHeroBackgroundColor = selectedStoryTag
    ? (heroColorByStory[selectedStoryTag] ?? selectedEdition?.branding?.accentColor ?? "#008cff")
    : (selectedEdition?.branding?.accentColor ?? "#008cff");
  const isDefaultHero = !selectedStoryTag;
  const editionAccentColor = selectedEdition?.branding?.accentColor ?? "#2461b8";
  const roadmapPanelImageSrc = "/updates/hero-roadmap.png";
  const roadmapPanelImageAlt = "Roadmap overview panel image";
  const roadmapPanelEyebrow = selectedRoadmapTag ? tagLabel[selectedRoadmapTag] : showRoadmapOnly ? "Roadmap mode" : "Roadmap overview";
  const roadmapPanelTitle = selectedRoadmapTag
    ? tagLabel[selectedRoadmapTag]
    : showRoadmapOnly
      ? "Roadmap items in focus"
      : "Upcoming roadmap work";
  const roadmapPanelBody = selectedRoadmapTag
    ? `Showing ${scopedRoadmapUpdates.length} roadmap item(s) for ${tagLabel[selectedRoadmapTag]}. Roadmap mode clears story-tag filtering so imported roadmap work stays in its own lane.`
    : showRoadmapOnly
      ? `Showing ${scopedRoadmapUpdates.length} roadmap item(s). Use the roadmap lane in the sidebar to narrow imported roadmap work without mixing it into story-led content.`
      : `Track ${roadmapUpdates.length} roadmap item(s) separately from story content. Imported roadmap cards now use team-based imagery and roadmap-specific topic tags instead of story tags.`;

  useEffect(() => {
    if (selectedUpdate && !filteredUpdates.some((item) => item.id === selectedUpdate.id)) {
      setSelectedUpdate(null);
    }
  }, [filteredUpdates, selectedUpdate]);


  useEffect(() => {
    if (selectedRoadmapMonth && !roadmapUpdatesByMonth.some((group) => group.key === selectedRoadmapMonth)) {
      setSelectedRoadmapMonth(null);
    }
  }, [roadmapUpdatesByMonth, selectedRoadmapMonth]);

  useEffect(() => {
    setRoadmapMonthRailStartIndex((current) => Math.min(current, maxRoadmapMonthRailStart));
  }, [maxRoadmapMonthRailStart]);

  useEffect(() => {
    const targetIndex = roadmapMonthRailNodes.findIndex((node) => node.key === selectedRoadmapMonthRailFocusKey);
    if (targetIndex < 0) {
      return;
    }

    setRoadmapMonthRailStartIndex((current) => {
      const windowStart = current;
      const windowEnd = current + roadmapMonthRailWindowSize - 1;
      if (targetIndex < windowStart) {
        return targetIndex;
      }
      if (targetIndex > windowEnd) {
        return Math.max(0, targetIndex - roadmapMonthRailWindowSize + 1);
      }
      return current;
    });
  }, [roadmapMonthRailNodes, selectedRoadmapMonthRailFocusKey]);

  useEffect(() => {
    setHeroImageIndex(0);
  }, [selectedStoryTag]);

  const toggleTag = (tag: UpdateTag) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  const selectStoryTag = (tag: StoryTag) => {
    setShowRoadmapOnly(false);
    setSelectedRoadmapTag(null);
    setSelectedStoryTag((current) => (current === tag ? null : tag));
  };

  const toggleRoadmapOnly = () => {
    const next = !showRoadmapOnly;
    setShowRoadmapOnly(next);
    setSelectedStoryTag(null);
    if (!next) {
      setSelectedRoadmapTag(null);
    }
  };

  const selectRoadmapTag = (tag: UpdateTag) => {
    setSelectedStoryTag(null);
    setShowRoadmapOnly(true);
    setSelectedRoadmapTag((current) => (current === tag ? null : tag));
  };

  const applyEditionQueryParam = (editionId: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (editionId) {
      params.set("edition", editionId);
    } else {
      params.delete("edition");
    }

    const query = params.toString();
    const nextPath = query ? pathname + "?" + query : pathname;
    router.replace(nextPath, { scroll: false });
  };

  const selectEdition = (editionId: string | null) => {
    setSelectedEditionId(editionId);
    applyEditionQueryParam(editionId);
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedStoryTag(null);
    setShowRoadmapOnly(false);
    setSelectedRoadmapTag(null);
    setSelectedRoadmapMonth(null);
    setSearchQuery("");
    setSelectedEditionId(defaultEditionId);
    applyEditionQueryParam(defaultEditionId);
  };

  useEffect(() => {
    const requestedEdition = new URLSearchParams(window.location.search).get("edition");
    if (!requestedEdition) {
      setSelectedEditionId(defaultEditionId);
      return;
    }

    const exists = editionOptions.some((edition) => edition.id === requestedEdition);
    setSelectedEditionId(exists ? requestedEdition : activeEditionId);
  }, [defaultEditionId, editionOptions]);

  const renderUpdateCard = (update: ProductUpdate, showImage = true) => (
    <article key={update.id} className="brand-panel flex w-full flex-col overflow-hidden rounded-2xl p-4 sm:w-[360px]">
      {showImage && update.imageSrc ? (
        <Image
          src={withPublicBasePath(update.imageSrc)}
          alt={update.imageAlt}
          width={800}
          height={420}
          className="h-44 w-full rounded-xl object-cover"
        />
      ) : null}
      <h2 className="title-font card-title mt-3 text-xl font-extrabold leading-7 text-zinc-950">{update.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#4e6378]">{update.summaryBody}</p>
      {update.tags.includes(ROADMAP_TAG) ? (
        <p className="meta-date mt-3 text-sm font-semibold">{formatReadableDate(update.date)}</p>
      ) : null}

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
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${tagBadgeClass(tag)}`}
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
  );

  return (
    <div className="brand-shell min-h-screen pb-12" style={{ borderTop: "4px solid " + editionAccentColor }}>
      <div className="mt-6 flex w-full flex-col gap-6 px-3 sm:px-4 lg:px-6 lg:flex-row lg:items-start">
        <div className="top-6 w-full lg:sticky lg:max-h-[calc(100vh-3rem)] lg:w-[305px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <aside className="brand-panel rounded-2xl p-5">
            <h2 className="text-base font-extrabold text-zinc-900">Filter updates</h2>
            <p className="mt-1 text-sm text-[#4e6378]">Refine by edition, story content and topic tags.</p>
            <section className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Edition</h3>
              <div role="radiogroup" aria-label="Edition filter" className="mt-2 flex flex-col gap-2">
                {editionOptions.map((edition) => {
                  const selected = selectedEditionId === edition.id;
                  return (
                    <button
                      key={edition.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectEdition(edition.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        selected
                          ? "text-white"
                          : "border-[#c5d5e8] bg-white text-zinc-800 hover:border-[#2461b8]"
                      }`}
                      style={selected ? { borderColor: editionAccentColor, backgroundColor: editionAccentColor } : undefined}
                    >
                      <span className="block">{edition.label}</span>
                      <span className={`block text-xs ${selected ? "text-white/80" : "text-[#4e6378]"}`}>{edition.theme}</span>
                    </button>
                  );
                })}
              </div>
            </section>

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
                {contentTagOptions.map((tag) => {
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
            <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-zinc-700">Roadmap</h3>
            <p className="mt-1 text-sm text-[#4e6378]">Toggle roadmap-only mode and narrow imported roadmap items by roadmap tag.</p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={toggleRoadmapOnly}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d8fdb] focus-visible:ring-offset-2 ${
                  showRoadmapOnly
                    ? "border-[#2461b8] bg-[#2461b8] text-white"
                    : "border-[#c5d5e8] bg-white text-zinc-800 hover:border-[#2461b8]"
                }`}
                aria-pressed={showRoadmapOnly}
              >
                Show roadmap
              </button>
              <div className="flex flex-wrap gap-2">
                {roadmapTagOptions.map((tag) => {
                  const active = selectedRoadmapTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => selectRoadmapTag(tag)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4d8fdb] focus-visible:ring-offset-2 ${
                        active
                          ? "border-[#1a4a96] bg-[#1a4a96] text-white"
                          : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#2461b8]"
                      }`}
                      aria-pressed={active}
                    >
                      {tagLabel[tag]}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="brand-panel mt-4 rounded-2xl p-4">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-zinc-700">Search updates</h3>
            <p className="mt-1 text-sm text-[#4e6378]">Search across titles, summaries, IDs, tags, story tags, dates, and detail content.</p>
            <div className="relative mt-3">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6c8198]"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="8.5" cy="8.5" r="5.25" />
                  <path d="M12.5 12.5L16.25 16.25" strokeLinecap="round" />
                </svg>
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search any term"
                className="w-full rounded-lg border border-[#c5d5e8] bg-white py-2 pl-10 pr-3 text-sm text-zinc-800"
              />
            </div>
          </section>

          {process.env.NODE_ENV === "development" ? (
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
          ) : null}
        </div>

        <main className="w-full space-y-5">
          <div>
            {isRoadmapPanelActive ? (
              <section
                className="brand-hero relative overflow-hidden rounded-2xl p-5 sm:p-7"
                style={{ background: "linear-gradient(135deg, #0d3f7a 0%, " + editionAccentColor + " 52%, #79b8f6 100%)" }}
              >
                <div className="relative z-10 grid h-full grid-cols-1 items-center gap-5 md:grid-cols-[1.15fr_0.85fr] md:gap-6">
                  <div className="max-w-2xl">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-white/90">
                      {roadmapPanelEyebrow}
                    </p>
                    <h1 className="title-font mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                      {roadmapPanelTitle}
                    </h1>
                    <p className="mt-3 text-base leading-7 text-white/90">{roadmapPanelBody}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/18 px-3 py-1.5 text-xs font-extrabold text-white">
                        {roadmapUpdates.length} total roadmap items
                      </span>
                      <span className="rounded-full bg-white/18 px-3 py-1.5 text-xs font-extrabold text-white">
                        {scopedRoadmapUpdates.length} visible
                      </span>
                      <span className="rounded-full bg-white/18 px-3 py-1.5 text-xs font-extrabold text-white">
                        {roadmapComingSoonCount} coming soon
                      </span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={showRoadmapOnly || selectedRoadmapTag ? clearFilters : toggleRoadmapOnly}
                        className="inline-flex rounded-full bg-[#1a2e44] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#102338]"
                      >
                        {showRoadmapOnly || selectedRoadmapTag ? "Show all updates" : "Show roadmap only"}
                      </button>
                    </div>
                  </div>

                  <div className="relative h-[240px] w-[380px] max-w-full shrink-0 overflow-hidden rounded-xl bg-white/20">
                    <Image
                      src={withPublicBasePath(roadmapPanelImageSrc)}
                      alt={roadmapPanelImageAlt}
                      fill
                      unoptimized
                      priority
                      sizes="(min-width: 1024px) 360px, 100vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              </section>
            ) : (
              <>
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
                      {activeHero.readMoreUrl ? (
                        isExternalUrl(activeHero.readMoreUrl) ? (
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
                        )
                      ) : null}
                    </div>

                    {activeHero.imageSrc ? (
                      <div className="relative h-[240px] w-[380px] max-w-full shrink-0 overflow-hidden rounded-xl bg-white/35">
                        <Image
                          src={withPublicBasePath(activeHero.imageSrc)}
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
              </>
            )}
          </div>
          {isRoadmapPanelActive ? (
            <section aria-label="Roadmap updates by month" className="space-y-5">
              <div className="brand-panel rounded-2xl p-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRoadmapTimeScope("future")}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          roadmapTimeScope === "future"
                            ? "border-[#1a4a96] bg-[#1a4a96] text-white"
                            : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#2461b8]"
                        }`}
                        aria-pressed={roadmapTimeScope === "future"}
                      >
                        In development ({roadmapScopeCounts.future})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoadmapTimeScope("past")}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          roadmapTimeScope === "past"
                            ? "border-[#1a4a96] bg-[#1a4a96] text-white"
                            : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#2461b8]"
                        }`}
                        aria-pressed={roadmapTimeScope === "past"}
                      >
                        Delivered ({roadmapScopeCounts.past})
                      </button>
                    </div>
                    <div className="w-full max-w-5xl">
                      <p className="mb-2 text-center text-xs font-semibold text-zinc-600">
                        Showing {roadmapTimeScope === "future" ? "In development" : "Delivered"} roadmap
                      </p>
                      <div className="relative mx-auto w-full max-w-4xl">
                        <div className="pointer-events-none absolute left-8 right-8 top-4 h-px bg-[#c5d5e8]" />
                        <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setRoadmapMonthRailStartIndex((current) => Math.max(0, current - 1))
                            }
                            disabled={!canShiftRoadmapMonthRailBack}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#c5d5e8] bg-white text-[#1a4a96] transition hover:border-[#2461b8] disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Show earlier months"
                          >
                            <span aria-hidden="true">‹</span>
                          </button>
                          <div className="relative flex items-center justify-center gap-2 overflow-hidden px-1 py-1">
                            {visibleRoadmapMonthRailNodes.map((node) => {
                              const active = selectedRoadmapMonth === node.key;
                              const showExpanded = active || node.isCurrentMonth;
                              const labelText = showExpanded
                                ? `${node.label} (${node.count})`
                                : `${node.compactLabel} (${node.count})`;

                              return (
                                <button
                                  key={node.key ?? "all-months"}
                                  type="button"
                                  onClick={() => setSelectedRoadmapMonth(node.key)}
                                  className={`inline-flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
                                    active
                                      ? "border-[#1a4a96] bg-[#1a4a96] text-white"
                                      : node.isCurrentMonth
                                        ? "border-[#2461b8] bg-[#e9f3ff] text-[#1a4a96] shadow-[0_0_0_1px_#79b8f6_inset]"
                                        : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#2461b8]"
                                  }`}
                                  aria-pressed={active}
                                  title={`${node.label} (${node.count})`}
                                >
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      active ? "bg-white" : node.isCurrentMonth ? "bg-[#2461b8]" : "bg-[#6d84a2]"
                                    }`}
                                  />
                                  <span className="truncate">{labelText}</span>
                                  {node.isCurrentMonth ? (
                                    <span
                                      className={`hidden rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] md:inline-flex ${
                                        active ? "bg-white/20 text-white" : "bg-[#d7e9ff] text-[#1a4a96]"
                                      }`}
                                    >
                                      Current
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setRoadmapMonthRailStartIndex((current) => Math.min(maxRoadmapMonthRailStart, current + 1))
                            }
                            disabled={!canShiftRoadmapMonthRailForward}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#c5d5e8] bg-white text-[#1a4a96] transition hover:border-[#2461b8] disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Show later months"
                          >
                            <span aria-hidden="true">›</span>
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

              </div>
              <section aria-label="Roadmap view introduction">
                <h2 className="title-font text-2xl font-extrabold tracking-tight text-zinc-950">
                  {roadmapTimeScope === "future" ? "In the works" : "Delivered"}
                </h2>
                <p className="mt-2 text-sm leading-7 text-[#4e6378] sm:text-base">
                  {roadmapTimeScope === "future"
                    ? "We're busy building the next updates and improvements that will make your life easier in FreeAgent. Here's what's coming next."
                    : "Explore whats been delivered on our roadmap toward helping every UK small business stay in control of their finances"}
                </p>
              </section>

              {visibleRoadmapUpdatesByMonth.map((group) => (
                <section key={group.key} aria-label={`${group.label} roadmap updates`}>
                  <h2 className="mb-3 text-sm font-extrabold uppercase tracking-[0.12em] text-[#315f9c]">
                    {group.label}
                  </h2>
                  <div className="flex flex-wrap gap-4">{group.items.map((u) => renderUpdateCard(u, false))}</div>
                </section>
              ))}
            </section>
          ) : (
            <section aria-label="Product updates" className="flex flex-wrap gap-4">
              {filteredUpdates.filter((update) => !update.tags.includes(ROADMAP_TAG)).map((u) => renderUpdateCard(u, true))}
            </section>
          )}

          {filteredUpdates.length === 0 ? (
            <section className="brand-panel rounded-2xl p-8 text-center">
              <h2 className="title-font text-xl font-extrabold text-zinc-950">No updates match your filters</h2>
              <p className="mt-2 text-[#4e6378]">Try removing one or more filters to see the full stream.</p>
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
                src={withPublicBasePath(previewUpdate.imageSrc)}
                alt={previewUpdate.imageAlt}
                width={1200}
                height={630}
                unoptimized
                className="mt-4 w-full rounded-xl object-contain"
              />
              {previewUpdate.tags.includes(ROADMAP_TAG) || !previewUpdate.tags.includes("coming-soon") ? (
                <p className="meta-date mt-3 text-sm font-semibold">{formatReadableDate(previewUpdate.date)}</p>
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
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${tagBadgeClass(tag)}`}
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
