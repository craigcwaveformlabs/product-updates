"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { storyTagLabel, storyTags as sharedStoryTags } from "../content/updates";

type DetailBlockType = "body" | "heading-lg" | "heading-sm";

type DetailBlock = {
  type: DetailBlockType;
  text: string;
};

type ImportFormat = "default" | "notion-roadmap";
type ImportPreviewActionFilter = "all" | "create" | "update" | "skip";
type ImportJobStatus = "idle" | "in-progress" | "success" | "error";

type ContentUpdate = {
  id: string;
  imageSrc: string;
  imageAlt: string;
  date: string;
  tags: string[];
  storyTags: string[];
  title: string;
  summaryBody: string;
  detailBody?: string[];
  detailBlocks?: DetailBlock[];
  readMoreUrl: string;
  pinnedForStories?: string[];
  pinInDefaultView?: boolean;
};

type ImportPreviewRow = {
  rowNumber: number;
  id: string;
  title: string;
  imageSrc: string;
  readMoreUrl: string;
  tags: string[];
  storyTags: string[];
  exists: boolean;
  action: "create" | "update" | "skip";
};

type NotionImportFilterOptions = {
  excludeInternalProject: boolean;
  requireDates: boolean;
  dateScope: "future-window" | "all-time";
  futureYears: number;
  allowedStatuses: string[];
  allowedTeams: string[];
};

const createEmptyDraft = (): ContentUpdate => ({
  id: "",
  imageSrc: "/updates/update-image.svg",
  imageAlt: "",
  date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
  tags: [],
  storyTags: [],
  title: "",
  summaryBody: "",
  detailBody: [""],
  detailBlocks: [
    {
      type: "body",
      text: "",
    },
  ],
  readMoreUrl: "https://www.freeagent.com/blog/",
});

function detailBodyToText(value?: string[]) {
  if (!value || !value.length) {
    return "";
  }
  return value.join("\n\n");
}

function textToDetailBody(text: string): string[] | undefined {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : undefined;
}

function normalizeTagInput(value: string): string {
  return value.trim().toLowerCase();
}

function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function normalizeDetailBlocks(update: ContentUpdate): DetailBlock[] {
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
      text: "",
    },
  ];
}

function blockTypeLabel(type: DetailBlockType): string {
  if (type === "heading-lg") {
    return "Heading 1";
  }
  if (type === "heading-sm") {
    return "Heading 2";
  }
  return "Body";
}

function parseFilterListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function ContentStudioPage() {
  const [updates, setUpdates] = useState<ContentUpdate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContentUpdate>(createEmptyDraft);
  const [detailBodyText, setDetailBodyText] = useState("");
  const [detailBlocks, setDetailBlocks] = useState<DetailBlock[]>(createEmptyDraft().detailBlocks ?? []);
  const [newTagInput, setNewTagInput] = useState("");
  const [newStoryTagInput, setNewStoryTagInput] = useState("");
  const [pinnedForStories, setPinnedForStories] = useState<string[]>([]);
  const [pinInDefaultView, setPinInDefaultView] = useState(false);
  const [sidebarStoryTagFilter, setSidebarStoryTagFilter] = useState<string | null>(null);
  const [sidebarIdSearch, setSidebarIdSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isDeletingImported, setIsDeletingImported] = useState(false);
  const [importJobStatus, setImportJobStatus] = useState<ImportJobStatus>("idle");
  const [importJobDetail, setImportJobDetail] = useState("No import run yet.");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importFormat, setImportFormat] = useState<ImportFormat>("default");
  const [skipExistingIdsOnImport, setSkipExistingIdsOnImport] = useState(true);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importPreviewFilter, setImportPreviewFilter] = useState<ImportPreviewActionFilter>("all");
  const [notionStatusFilterText, setNotionStatusFilterText] = useState("Proposal - In Progress\nProposal - For Review\nBacklog\nDefine\nBuild");
  const [notionTeamFilterText, setNotionTeamFilterText] = useState("Connections & Add-ons\nWorkflow\nBanking Integrations\nPractice Experience\nTax Engineering\nMobile\nMarketing Platform\nPractice Growth");
  const [notionDateScope, setNotionDateScope] = useState<"future-window" | "all-time">("future-window");
  const [notionFutureYears, setNotionFutureYears] = useState("4");
  const [notionExcludeInternalProject, setNotionExcludeInternalProject] = useState(true);
  const [notionRequireDates, setNotionRequireDates] = useState(true);
  const [activeNotionFilters, setActiveNotionFilters] = useState<NotionImportFilterOptions | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const isViewerOnly = process.env.NEXT_PUBLIC_VIEWER_ONLY === "true";

  const selectedUpdate = useMemo(
    () => (selectedId ? updates.find((update) => update.id === selectedId) ?? null : null),
    [selectedId, updates],
  );

  const tagOptions = useMemo(() => {
    return Array.from(new Set([...updates.flatMap((update) => update.tags), ...draft.tags])).sort();
  }, [draft.tags, updates]);

  const storyTagOptions = useMemo(() => {
    const discoveredStoryTags = Array.from(
      new Set([
        ...sharedStoryTags,
        ...updates.flatMap((update) => update.storyTags),
        ...draft.storyTags,
        ...pinnedForStories,
      ]),
    );

    return [
      ...sharedStoryTags.filter((tag) => discoveredStoryTags.includes(tag)),
      ...discoveredStoryTags.filter((tag) => !sharedStoryTags.includes(tag)).sort(),
    ];
  }, [draft.storyTags, pinnedForStories, updates]);

  const sidebarStoryTagOptions = useMemo(() => {
    const discoveredStoryTags = Array.from(new Set(updates.flatMap((update) => update.storyTags)));

    return [
      ...sharedStoryTags.filter((tag) => discoveredStoryTags.includes(tag)),
      ...discoveredStoryTags.filter((tag) => !sharedStoryTags.includes(tag)).sort(),
    ];
  }, [updates]);

  const filteredUpdates = useMemo(() => {
    const normalizedSearch = sidebarIdSearch.trim().toLowerCase();

    return updates.filter((update) => {
      const matchesStory = sidebarStoryTagFilter ? update.storyTags.includes(sidebarStoryTagFilter) : true;
      const matchesIdOrTag = normalizedSearch
        ? update.id.toLowerCase().includes(normalizedSearch) ||
          update.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
        : true;
      return matchesStory && matchesIdOrTag;
    });
  }, [sidebarIdSearch, sidebarStoryTagFilter, updates]);


  const importPreviewCounts = useMemo(() => {
    return importPreviewRows.reduce(
      (acc, row) => {
        acc[row.action] += 1;
        return acc;
      },
      { create: 0, update: 0, skip: 0 },
    );
  }, [importPreviewRows]);

  const visibleImportPreviewRows = useMemo(() => {
    if (importPreviewFilter === "all") {
      return importPreviewRows;
    }

    return importPreviewRows.filter((row) => row.action === importPreviewFilter);
  }, [importPreviewFilter, importPreviewRows]);


  const notionFilterOptions = useMemo<NotionImportFilterOptions>(() => {
    const parsedYears = Number.parseInt(notionFutureYears, 10);
    return {
      excludeInternalProject: notionExcludeInternalProject,
      requireDates: notionRequireDates,
      dateScope: notionDateScope,
      futureYears: Number.isFinite(parsedYears) && parsedYears >= 0 ? parsedYears : 4,
      allowedStatuses: parseFilterListInput(notionStatusFilterText),
      allowedTeams: parseFilterListInput(notionTeamFilterText),
    };
  }, [
    notionDateScope,
    notionExcludeInternalProject,
    notionFutureYears,
    notionRequireDates,
    notionStatusFilterText,
    notionTeamFilterText,
  ]);

  const notionFilterSummaryLines = useMemo(() => {
    return [
      notionFilterOptions.excludeInternalProject
        ? "Exclude rows where Team / Internal project is ticked"
        : "Allow internal project rows",
      notionFilterOptions.requireDates ? "Require Dates value" : "Dates value optional",
      notionFilterOptions.dateScope === "all-time"
        ? "Date scope: All time"
        : `Date scope: Within next ${notionFilterOptions.futureYears} year(s)`,
      `Allowed statuses: ${
        notionFilterOptions.allowedStatuses.length
          ? notionFilterOptions.allowedStatuses.join(", ")
          : "(none)"
      }`,
      `Allowed teams: ${
        notionFilterOptions.allowedTeams.length ? notionFilterOptions.allowedTeams.join(", ") : "(none)"
      }`,
    ];
  }, [notionFilterOptions]);

  const loadUpdates = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/content/updates", { cache: "no-store" });
      const payload = (await response.json()) as { updates?: ContentUpdate[]; error?: string };
      if (!response.ok || !payload.updates) {
        throw new Error(payload.error ?? "Failed to load updates.");
      }

      setUpdates(payload.updates);
      if (payload.updates.length) {
        const next = payload.updates[0];
        setSelectedId((current) => current ?? next.id);
        if (!selectedId && !isCreating) {
          setDraft(next);
          setDetailBodyText(detailBodyToText(next.detailBody));
          setDetailBlocks(normalizeDetailBlocks(next));
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load updates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isViewerOnly) {
      setIsLoading(false);
      return;
    }

    void loadUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewerOnly]);

  useEffect(() => {
    if (!selectedUpdate || isCreating) {
      return;
    }
    setDraft(selectedUpdate);
    setDetailBodyText(detailBodyToText(selectedUpdate.detailBody));
    setDetailBlocks(normalizeDetailBlocks(selectedUpdate));
    setPinnedForStories(selectedUpdate.pinnedForStories ?? []);
    setPinInDefaultView(selectedUpdate.pinInDefaultView ?? false);
  }, [isCreating, selectedUpdate]);

  useEffect(() => {
    if (sidebarStoryTagFilter && !sidebarStoryTagOptions.includes(sidebarStoryTagFilter)) {
      setSidebarStoryTagFilter(null);
    }
  }, [sidebarStoryTagFilter, sidebarStoryTagOptions]);

  const startCreate = () => {
    setIsCreating(true);
    setSelectedId(null);
    const fresh = createEmptyDraft();
    setDraft(fresh);
    setDetailBodyText(detailBodyToText(fresh.detailBody));
    setDetailBlocks(normalizeDetailBlocks(fresh));
    setNewTagInput("");
    setNewStoryTagInput("");
    setPinnedForStories([]);
    setPinInDefaultView(false);
    setMessage("");
    setError("");
  };

  const selectUpdate = (update: ContentUpdate) => {
    setIsCreating(false);
    setSelectedId(update.id);
    setDraft(update);
    setDetailBodyText(detailBodyToText(update.detailBody));
    setDetailBlocks(normalizeDetailBlocks(update));
    setNewTagInput("");
    setNewStoryTagInput("");
    setPinnedForStories(update.pinnedForStories ?? []);
    setPinInDefaultView(update.pinInDefaultView ?? false);
    setMessage("");
    setError("");
  };

  const toggleArrayValue = (field: "tags" | "storyTags", value: string) => {
    setDraft((current) => {
      const activeValues = current[field];
      const nextValues = activeValues.includes(value)
        ? activeValues.filter((entry) => entry !== value)
        : [...activeValues, value];
      return { ...current, [field]: nextValues };
    });
  };

  const addTagValue = (field: "tags" | "storyTags", rawValue: string) => {
    const normalized = normalizeTagInput(rawValue);
    if (!normalized) {
      setError("Tag value cannot be empty.");
      return false;
    }
    if (!isKebabCase(normalized)) {
      setError("Tags must be kebab-case, for example cashflow-forecasting.");
      return false;
    }

    setError("");
    setDraft((current) => {
      const values = current[field];
      if (values.includes(normalized)) {
        return current;
      }
      return { ...current, [field]: [...values, normalized] };
    });
    return true;
  };

  const updateDetailBlock = (index: number, patch: Partial<DetailBlock>) => {
    setDetailBlocks((current) =>
      current.map((block, blockIndex) => {
        if (blockIndex !== index) {
          return block;
        }
        return {
          ...block,
          ...patch,
        };
      }),
    );
  };

  const removeDetailBlock = (index: number) => {
    setDetailBlocks((current) => {
      const next = current.filter((_, blockIndex) => blockIndex !== index);
      return next.length
        ? next
        : [
            {
              type: "body",
              text: "",
            },
          ];
    });
  };

  const addDetailBlock = (type: DetailBlockType) => {
    setDetailBlocks((current) => [
      ...current,
      {
        type,
        text: "",
      },
    ]);
  };

  const saveDraft = async () => {
    setIsSaving(true);
    setMessage("");
    setError("");

    const cleanedBlocks = detailBlocks
      .map((block) => ({
        type: block.type,
        text: block.text.trim(),
      }))
      .filter((block) => block.text.length > 0);

    const payload: ContentUpdate = {
      ...draft,
      id: draft.id.trim(),
      imageSrc: draft.imageSrc.trim(),
      imageAlt: draft.imageAlt.trim(),
      date: draft.date.trim(),
      title: draft.title.trim(),
      summaryBody: draft.summaryBody.trim(),
      readMoreUrl: draft.readMoreUrl.trim(),
      detailBody: textToDetailBody(detailBodyText),
      detailBlocks: cleanedBlocks.length ? cleanedBlocks : undefined,
      pinnedForStories: pinnedForStories.length ? pinnedForStories : undefined,
      pinInDefaultView: pinInDefaultView || undefined,
    };

    if (!payload.id) {
      setIsSaving(false);
      setError("Id is required.");
      return;
    }

    try {
      const method = isCreating ? "POST" : "PUT";
      const endpoint = isCreating ? "/api/content/updates" : `/api/content/updates/${payload.id}`;

      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { update?: ContentUpdate; error?: string };
      if (!response.ok || !result.update) {
        throw new Error(result.error ?? "Failed to save update.");
      }

      await loadUpdates();
      setIsCreating(false);
      setSelectedId(result.update.id);
      setDraft(result.update);
      setDetailBodyText(detailBodyToText(result.update.detailBody));
      setDetailBlocks(normalizeDetailBlocks(result.update));
      setPinnedForStories(result.update.pinnedForStories ?? []);
      setPinInDefaultView(result.update.pinInDefaultView ?? false);
      setMessage(`Saved ${result.update.id}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save update.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedId) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedId}? This removes content/updates/${selectedId}.json.`);
    if (!confirmed) {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/content/updates/${selectedId}`, { method: "DELETE" });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Failed to delete update.");
      }

      await loadUpdates();
      setIsCreating(false);
      const remaining = updates.filter((update) => update.id !== selectedId);
      if (remaining.length) {
        const first = remaining[0];
        setSelectedId(first.id);
      } else {
        setSelectedId(null);
        startCreate();
      }
      setMessage(`Deleted ${selectedId}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete update.");
    } finally {
      setIsSaving(false);
    }
  };

  const generateContent = async () => {
    setIsGenerating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/content/generate", { method: "POST" });
      const payload = (await response.json()) as { ok?: boolean; output?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to generate content.");
      }

      setMessage(payload.output || "Content generated.");
      await loadUpdates();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Failed to generate content.");
    } finally {
      setIsGenerating(false);
    }
  };

  const previewImport = async () => {
    if (!csvFile) {
      setError("Select a CSV file first.");
      return;
    }

    setIsPreviewingImport(true);
    setError("");
    setMessage("");

    try {
      const csv = await csvFile.text();
      const response = await fetch("/api/content/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          csv,
          skipExistingIds: skipExistingIdsOnImport,
          importFormat,
          previewOnly: true,
          notionFilterOptions: importFormat === "notion-roadmap" ? notionFilterOptions : undefined,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
        skippedCount?: number;
        filteredCount?: number;
        previewRows?: ImportPreviewRow[];
        activeNotionFilters?: NotionImportFilterOptions | null;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to preview CSV import.");
      }

      setImportPreviewRows(payload.previewRows ?? []);
      setImportPreviewFilter("all");
      setActiveNotionFilters(payload.activeNotionFilters ?? null);
      setMessage(
        `Previewed ${payload.importedCount ?? 0} rows (${payload.createdCount ?? 0} create, ${payload.updatedCount ?? 0} update, ${payload.skippedCount ?? 0} skip, ${payload.filteredCount ?? 0} filtered).`,
      );
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Failed to preview CSV import.");
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const importCsv = async () => {
    if (!csvFile) {
      setError("Select a CSV file first.");
      return;
    }

    setIsImporting(true);
    setError("");
    setMessage("");
    setImportJobStatus("in-progress");
    setImportJobDetail("Import in progress...");

    try {
      const csv = await csvFile.text();
      const response = await fetch("/api/content/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          csv,
          skipExistingIds: skipExistingIdsOnImport,
          importFormat,
          notionFilterOptions: importFormat === "notion-roadmap" ? notionFilterOptions : undefined,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        importedCount?: number;
        createdCount?: number;
        updatedCount?: number;
        skippedCount?: number;
        filteredCount?: number;
        activeNotionFilters?: NotionImportFilterOptions | null;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to import CSV.");
      }

      const importSummary = `${importFormat === "notion-roadmap" ? "Imported Notion export" : "Processed CSV"} ${payload.importedCount ?? 0} rows (${payload.createdCount ?? 0} created, ${payload.updatedCount ?? 0} updated, ${payload.skippedCount ?? 0} skipped, ${payload.filteredCount ?? 0} filtered).`;
      setMessage(importSummary);
      setImportJobStatus("success");
      setImportJobDetail(importSummary);
      setActiveNotionFilters(payload.activeNotionFilters ?? null);
      setImportPreviewRows([]);
      setImportPreviewFilter("all");
      setCsvFile(null);
      await loadUpdates();
    } catch (importError) {
      const importErrorMessage = importError instanceof Error ? importError.message : "Failed to import CSV.";
      setError(importErrorMessage);
      setImportJobStatus("error");
      setImportJobDetail(importErrorMessage);
    } finally {
      setIsImporting(false);
    }
  };


  const deleteImportedUpdates = async () => {
    const confirmed = window.confirm(
      "Delete all imported updates? This only removes files from content/imported-updates and keeps your manual updates in content/updates.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingImported(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/content/imported", { method: "DELETE" });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        deletedCount?: number;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Failed to delete imported updates.");
      }

      setImportPreviewRows([]);
      setImportPreviewFilter("all");
      setMessage(`Deleted ${payload.deletedCount ?? 0} imported update(s).`);
      await loadUpdates();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete imported updates.");
    } finally {
      setIsDeletingImported(false);
    }
  };

  const downloadCsvTemplate = (includeSampleRow: boolean) => {
    const headers = [
      "id",
      "imageSrc",
      "imageAlt",
      "date",
      "tags",
      "storyTags",
      "title",
      "summaryBody",
      "readMoreUrl",
      "detailBody",
      "pinnedForStories",
      "pinInDefaultView",
      "detailBlocks",
    ];

    const sampleRow = [
      "sample-update-id",
      "/updates/sample-update.png",
      "Sample update preview image",
      "12 Jun 2026",
      "coming-soon|automation",
      "built-for-every-business",
      "Sample feature update",
      "A short summary for the card preview.",
      "https://www.freeagent.com/blog/",
      "First optional detail paragraph|Second optional detail paragraph",
      "built-for-every-business",
      "true",
      '[{"type":"heading-sm","text":"What is new"},{"type":"body","text":"Optional detail blocks as JSON."}]',
    ];

    const escapeCsvField = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = includeSampleRow ? [headers, sampleRow] : [headers];
    const csv = rows
      .map((row) => row.map((value) => escapeCsvField(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = includeSampleRow ? "content-updates-template.csv" : "content-updates-template-blank.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadNotionRoadmapTemplate = () => {
    const headers = [
      "Project name",
      "Status",
      "Impact",
      "Product Story",
      "Dates",
      "End month",
      "ID",
    ];

    const sampleRow = [
      "Smarter bank feed matching",
      "In Progress",
      "Improve matching logic for recurring feed transactions.",
      "transformative-accounting",
      "2026-07-01",
      "",
      "smarter-bank-feed-matching",
    ];

    const escapeCsvField = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [headers, sampleRow]
      .map((row) => row.map((value) => escapeCsvField(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "notion-roadmap-import-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadExistingContentCsv = () => {
    if (!updates.length) {
      setError("No existing updates available to export.");
      return;
    }

    setError("");

    const headers = [
      "id",
      "imageSrc",
      "imageAlt",
      "date",
      "tags",
      "storyTags",
      "title",
      "summaryBody",
      "readMoreUrl",
      "detailBody",
      "pinnedForStories",
      "pinInDefaultView",
      "detailBlocks",
    ];

    const escapeCsvField = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = updates.map((update) => [
      update.id,
      update.imageSrc,
      update.imageAlt,
      update.date,
      update.tags.join("|"),
      update.storyTags.join("|"),
      update.title,
      update.summaryBody,
      update.readMoreUrl,
      (update.detailBody ?? []).join("|"),
      (update.pinnedForStories ?? []).join("|"),
      update.pinInDefaultView ? "true" : "false",
      update.detailBlocks?.length ? JSON.stringify(update.detailBlocks) : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvField(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "content-updates-export.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (isViewerOnly) {
    return (
      <div className="brand-shell min-h-screen p-6">
        <div className="mx-auto mt-10 w-full max-w-2xl rounded-2xl border border-[#c5d5e8] bg-white p-6 text-center">
          <h1 className="title-font text-2xl font-extrabold text-zinc-950">Content Studio unavailable</h1>
          <p className="mt-3 text-sm text-[#4e6378]">
            Content Studio is not available in the viewer-only static build.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full border border-[#c5d5e8] bg-white px-4 py-2 text-sm font-bold text-zinc-800 hover:border-[#2461b8]"
          >
            Back to updates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="brand-shell min-h-screen pb-12">
      <div className="mx-auto w-full max-w-[1400px] px-3 pt-6 sm:px-4 lg:px-6">
        <header className="brand-panel rounded-2xl p-5">
          <div className="space-y-4">
            <div>
              <h1 className="title-font text-3xl font-extrabold text-zinc-950">Content Studio</h1>
              <p className="mt-1 text-sm text-[#4e6378]">
                Create and edit product update cards, import updates from CSV, then regenerate app content.
              </p>
              <p className="mt-2 text-xs text-[#4e6378]">
                Default CSV columns: id,imageSrc,imageAlt,date,tags,storyTags,title,summaryBody,readMoreUrl (+ optional detailBody,detailBlocks,pinnedForStories,pinInDefaultView).
                Notion roadmap schema: Project name, Status, Impact, Product Story, Dates, End month, ID.
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <section className="rounded-xl border border-[#d2e0f1] bg-[#f8fbff] p-3">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#315f9c]">Templates & Exports</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => downloadCsvTemplate(true)} className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-[#2461b8]">Sample CSV</button>
                  <button type="button" onClick={() => downloadCsvTemplate(false)} className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-[#2461b8]">Blank CSV</button>
                  <button type="button" onClick={downloadExistingContentCsv} className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-[#2461b8]">Export Existing</button>
                  <button type="button" onClick={downloadNotionRoadmapTemplate} className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:border-[#2461b8]">Notion Template</button>
                </div>
              </section>

              <section className="rounded-xl border border-[#d2e0f1] bg-[#f8fbff] p-3">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#315f9c]">Import Source</h2>
                <div className="mt-2 space-y-2">
                  <label className="block cursor-pointer rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:border-[#2461b8]">
                    {csvFile ? csvFile.name : "Choose CSV file"}
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] ?? null;
                        setCsvFile(selectedFile);
                        setImportPreviewRows([]);
                        setImportPreviewFilter("all");
                        setImportJobStatus("idle");
                        setImportJobDetail(selectedFile ? "File ready: " + selectedFile.name : "No file selected.");
                      }}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                      <span className="block text-[11px] uppercase tracking-[0.08em] text-zinc-500">Format</span>
                      <select
                        value={importFormat}
                        onChange={(event) => {
                          setImportFormat(event.target.value as ImportFormat);
                          setImportPreviewRows([]);
                          setImportPreviewFilter("all");
                        }}
                        className="mt-1 w-full rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs font-semibold text-zinc-800"
                      >
                        <option value="default">Default CSV</option>
                        <option value="notion-roadmap">Notion roadmap CSV</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                      <input type="checkbox" checked={skipExistingIdsOnImport} onChange={(event) => setSkipExistingIdsOnImport(event.target.checked)} className="h-3.5 w-3.5 rounded border-[#c5d5e8]" />
                      Skip existing IDs
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#d2e0f1] bg-[#f8fbff] p-3">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#315f9c]">Import Actions</h2>
                <p className="mt-1 text-xs text-[#4e6378]">Preview first, then import. Regenerate content when done.</p>
                <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${importJobStatus === "success" ? "border-[#b8d6b5] bg-[#e9f8e7] text-[#1e6b2f]" : importJobStatus === "error" ? "border-[#efb9b9] bg-[#fff0f0] text-[#8a2121]" : importJobStatus === "in-progress" ? "border-[#c8d4e7] bg-[#eef3fb] text-[#315f9c]" : "border-[#d7e4f4] bg-white text-[#4e6378]"}`}>
                  <p className="font-extrabold uppercase tracking-[0.08em]">Import Status: {importJobStatus === "in-progress" ? "Running" : importJobStatus === "success" ? "Success" : importJobStatus === "error" ? "Failed" : "Idle"}</p>
                  <p className="mt-1 text-xs">{importJobDetail}</p>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <button type="button" onClick={previewImport} disabled={isPreviewingImport || !csvFile} className="rounded-lg border border-[#1a4a96] bg-[#e8f2fb] px-4 py-2 text-sm font-extrabold text-[#1a4a96] disabled:cursor-not-allowed disabled:opacity-60">{isPreviewingImport ? "Previewing..." : "Preview Import"}</button>
                  <button type="button" onClick={importCsv} disabled={isImporting || !csvFile} className="rounded-lg border border-[#1a4a96] bg-white px-4 py-2 text-sm font-extrabold text-[#1a4a96] disabled:cursor-not-allowed disabled:opacity-60">{isImporting ? "Importing..." : importFormat === "notion-roadmap" ? "Import Notion CSV" : "Import CSV"}</button>
                  <button type="button" onClick={generateContent} disabled={isGenerating} className="rounded-lg bg-[#1a4a96] px-4 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60">{isGenerating ? "Generating..." : "Generate Content"}</button>
                  <Link href="/" className="rounded-lg border border-[#c5d5e8] bg-white px-4 py-2 text-center text-sm font-extrabold text-zinc-800 hover:border-[#2461b8]">View Site</Link>
                  <button type="button" onClick={deleteImportedUpdates} disabled={isDeletingImported} className="rounded-lg border border-[#b83232] bg-[#fff5f5] px-4 py-2 text-sm font-extrabold text-[#8f2323] hover:bg-[#ffe8e8] disabled:cursor-not-allowed disabled:opacity-60">{isDeletingImported ? "Deleting imported..." : "Delete Imported"}</button>
                </div>
              </section>
            </div>

            {importFormat === "notion-roadmap" ? (
              <section className="rounded-xl border border-[#c9dbef] bg-[#f4f9ff] p-3">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.1em] text-[#315f9c]">Notion Filter Rules</h2>
                <p className="mt-1 text-xs text-[#4e6378]">Adjust filters here without code changes. These rules are sent with preview/import.</p>
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  <label className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                    <span className="block text-[11px] uppercase tracking-[0.08em] text-zinc-500">Allowed Statuses (comma or newline)</span>
                    <textarea value={notionStatusFilterText} onChange={(event) => setNotionStatusFilterText(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs text-zinc-800" />
                  </label>
                  <label className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                    <span className="block text-[11px] uppercase tracking-[0.08em] text-zinc-500">Allowed Teams (comma or newline)</span>
                    <textarea value={notionTeamFilterText} onChange={(event) => setNotionTeamFilterText(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs text-zinc-800" />
                  </label>
                </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <label className="flex items-center gap-2 rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700"><input type="checkbox" checked={notionExcludeInternalProject} onChange={(event) => setNotionExcludeInternalProject(event.target.checked)} className="h-3.5 w-3.5 rounded border-[#c5d5e8]" />Exclude internal project rows</label>
                    <label className="flex items-center gap-2 rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700"><input type="checkbox" checked={notionRequireDates} onChange={(event) => setNotionRequireDates(event.target.checked)} className="h-3.5 w-3.5 rounded border-[#c5d5e8]" />Require Dates value</label>
                    <label className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                      <span className="block text-[11px] uppercase tracking-[0.08em] text-zinc-500">Date scope</span>
                      <select value={notionDateScope} onChange={(event) => setNotionDateScope(event.target.value as "future-window" | "all-time")} className="mt-1 w-full rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs text-zinc-800">
                        <option value="future-window">Within future window</option>
                        <option value="all-time">Show all time</option>
                      </select>
                    </label>
                    <label className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
                      <span className="block text-[11px] uppercase tracking-[0.08em] text-zinc-500">Future window (years)</span>
                      <input type="number" min={0} max={10} value={notionFutureYears} onChange={(event) => setNotionFutureYears(event.target.value)} disabled={notionDateScope === "all-time"} className="mt-1 w-full rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs text-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500" />
                    </label>
                  </div>
                <div className="mt-2 rounded-lg border border-[#d7e4f4] bg-white px-3 py-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#315f9c]">Active Filter Summary</p>
                  <ul className="mt-1 space-y-1 text-xs text-[#4e6378]">{notionFilterSummaryLines.map((line) => <li key={line}>- {line}</li>)}</ul>
                  {activeNotionFilters ? <p className="mt-2 text-[11px] text-[#315f9c]">Last preview/import used these rules.</p> : null}
                </div>
              </section>
            ) : null}
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[#dff4e8] px-3 py-2 text-sm text-[#1e5d40]">{message}</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-[#ffe7e7] px-3 py-2 text-sm text-[#8a2121]">{error}</p> : null}
          {importPreviewRows.length ? (
            <div className="mt-3 rounded-lg border border-[#c5d5e8] bg-white p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#b7cbe3] bg-[#f2f7fd] px-2.5 py-1 text-[11px] font-bold text-[#1a4a96]">
                    Total {importPreviewRows.length}
                  </span>
                  <span className="rounded-full border border-[#b8d6b5] bg-[#e9f8e7] px-2.5 py-1 text-[11px] font-bold text-[#1e6b2f]">
                    Create {importPreviewCounts.create}
                  </span>
                  <span className="rounded-full border border-[#c8d4e7] bg-[#eef3fb] px-2.5 py-1 text-[11px] font-bold text-[#315f9c]">
                    Update {importPreviewCounts.update}
                  </span>
                  <span className="rounded-full border border-[#e7d3a7] bg-[#fff5df] px-2.5 py-1 text-[11px] font-bold text-[#8a6425]">
                    Skip {importPreviewCounts.skip}
                  </span>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                  <span>Show</span>
                  <select
                    value={importPreviewFilter}
                    onChange={(event) => setImportPreviewFilter(event.target.value as ImportPreviewActionFilter)}
                    className="rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs font-semibold text-zinc-800"
                  >
                    <option value="all">All actions</option>
                    <option value="create">Create only</option>
                    <option value="update">Update only</option>
                    <option value="skip">Skip only</option>
                  </select>
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="bg-[#f2f7fd] text-zinc-700">
                    <tr>
                      <th className="px-3 py-2 font-bold">Row</th>
                      <th className="px-3 py-2 font-bold">Action</th>
                      <th className="px-3 py-2 font-bold">ID</th>
                      <th className="px-3 py-2 font-bold">Title</th>
                      <th className="px-3 py-2 font-bold">Image</th>
                      <th className="px-3 py-2 font-bold">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleImportPreviewRows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.id}`} className="border-t border-[#e5eef8]">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              row.action === "create"
                                ? "border border-[#8dc79a] bg-[#e9f8e7] text-[#1e6b2f]"
                                : row.action === "update"
                                  ? "border border-[#b6c7e3] bg-[#edf3ff] text-[#315f9c]"
                                  : "border border-[#e0c98f] bg-[#fff5df] text-[#8a6425]"
                            }`}
                          >
                            {row.action}
                          </span>
                        </td>
                        <td className="px-3 py-2">{row.id}</td>
                        <td className="px-3 py-2">{row.title}</td>
                        <td className="px-3 py-2">{row.imageSrc}</td>
                        <td className="px-3 py-2">{row.readMoreUrl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="brand-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-zinc-900">Updates</h2>
              <button
                type="button"
                onClick={startCreate}
                className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:border-[#2461b8]"
              >
                New
              </button>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500" htmlFor="sidebar-story-filter">
                Filter by story
              </label>
              <select
                id="sidebar-story-filter"
                value={sidebarStoryTagFilter ?? ""}
                onChange={(event) => setSidebarStoryTagFilter(event.target.value || null)}
                className="mt-2 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm font-semibold text-zinc-800"
              >
                <option value="">All stories</option>
                {sidebarStoryTagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {storyTagLabel[tag] ?? tag}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500" htmlFor="sidebar-id-search">
                Search by ID or Tag
              </label>
              <input
                id="sidebar-id-search"
                value={sidebarIdSearch}
                onChange={(event) => setSidebarIdSearch(event.target.value)}
                placeholder="e.g. mtd, built-for-every-business, coming-soon"
                className="mt-2 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm text-zinc-800"
              />
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {isLoading ? <p className="text-sm text-[#4e6378]">Loading...</p> : null}
              {!isLoading && updates.length === 0 ? <p className="text-sm text-[#4e6378]">No updates found.</p> : null}
              {!isLoading && updates.length > 0 && filteredUpdates.length === 0 ? (
                <p className="text-sm text-[#4e6378]">No updates match the current filters.</p>
              ) : null}
              {filteredUpdates.map((update) => {
                const active = !isCreating && selectedId === update.id;
                const hasDefaultPin = update.pinInDefaultView === true;
                const storyPinCount = update.pinnedForStories?.length ?? 0;
                return (
                  <button
                    key={update.id}
                    type="button"
                    onClick={() => selectUpdate(update)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-[#2461b8] bg-[#2461b8] text-white"
                        : "border-[#c5d5e8] bg-white text-zinc-900 hover:border-[#2461b8]"
                    }`}
                  >
                    <p className="text-sm font-bold">{update.title}</p>
                    <p className={`mt-1 text-xs ${active ? "text-white/85" : "text-[#4e6378]"}`}>{update.id}</p>
                    {hasDefaultPin || storyPinCount > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {hasDefaultPin ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              active
                                ? "border-white/60 bg-white/15 text-white"
                                : "border-[#9cbce0] bg-[#e8f2ff] text-[#1b4f9a]"
                            }`}
                          >
                            Pinned: Default
                          </span>
                        ) : null}
                        {storyPinCount > 0 ? (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                              active
                                ? "border-white/60 bg-white/15 text-white"
                                : "border-[#b4bf90] bg-[#f0f7d8] text-[#4f5f1f]"
                            }`}
                          >
                            {storyPinCount === 1 ? "Pinned: 1 Story" : `Pinned: ${storyPinCount} Stories`}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="brand-panel rounded-2xl p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold text-zinc-950">
                {isCreating ? "Create Update" : `Edit ${draft.id || "Update"}`}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {!isCreating && selectedId ? (
                  <button
                    type="button"
                    onClick={deleteSelected}
                    disabled={isSaving}
                    className="rounded-full border border-[#e5bcbc] bg-white px-4 py-2 text-sm font-bold text-[#8a2121] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={isSaving}
                  className="rounded-full bg-[#1a4a96] px-5 py-2 text-sm font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-zinc-800">
                Id
                <input
                  value={draft.id}
                  onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                  disabled={!isCreating}
                  className="mt-1 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm disabled:bg-[#f3f6fa]"
                  placeholder="kebab-case-id"
                />
              </label>

              <label className="block text-sm font-semibold text-zinc-800">
                Date
                <input
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                  placeholder="11 Jun 2026"
                />
              </label>

              <label className="block text-sm font-semibold text-zinc-800 sm:col-span-2">
                Title
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm font-semibold text-zinc-800 sm:col-span-2">
                Summary Body
                <textarea
                  value={draft.summaryBody}
                  onChange={(event) => setDraft((current) => ({ ...current, summaryBody: event.target.value }))}
                  className="mt-1 min-h-[88px] w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                />
              </label>

              <div className="sm:col-span-2 rounded-xl border border-[#c5d5e8] bg-[#f8fbff] p-3">
                <p className="text-sm font-semibold text-zinc-800">Detail Content Blocks</p>
                <p className="mt-1 text-xs text-[#4e6378]">
                  Use `**bold**` and `*italic*` inline. Add Body, Heading 1, or Heading 2 blocks.
                </p>

                <div className="mt-3 space-y-3">
                  {detailBlocks.map((block, index) => (
                    <div key={`${index}-${block.type}`} className="rounded-lg border border-[#d7e3f2] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-600">
                          Block Type
                          <select
                            value={block.type}
                            onChange={(event) =>
                              updateDetailBlock(index, { type: event.target.value as DetailBlockType })
                            }
                            className="ml-2 rounded-md border border-[#c5d5e8] bg-white px-2 py-1 text-xs font-semibold"
                          >
                            <option value="body">Body</option>
                            <option value="heading-lg">Heading 1</option>
                            <option value="heading-sm">Heading 2</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeDetailBlock(index)}
                          className="rounded-md border border-[#e5bcbc] bg-white px-2 py-1 text-xs font-bold text-[#8a2121]"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#4e6378]">{blockTypeLabel(block.type)}</p>
                      <textarea
                        value={block.text}
                        onChange={(event) => updateDetailBlock(index, { text: event.target.value })}
                        className="mt-2 min-h-[92px] w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addDetailBlock("body")}
                    className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:border-[#2461b8]"
                  >
                    + Body
                  </button>
                  <button
                    type="button"
                    onClick={() => addDetailBlock("heading-lg")}
                    className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:border-[#2461b8]"
                  >
                    + Heading 1
                  </button>
                  <button
                    type="button"
                    onClick={() => addDetailBlock("heading-sm")}
                    className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:border-[#2461b8]"
                  >
                    + Heading 2
                  </button>
                </div>
              </div>

              <label className="block text-sm font-semibold text-zinc-800 sm:col-span-2">
                Legacy Detail Body (optional fallback)
                <textarea
                  value={detailBodyText}
                  onChange={(event) => setDetailBodyText(event.target.value)}
                  className="mt-1 min-h-[120px] w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm font-semibold text-zinc-800">
                Image Source
                <input
                  value={draft.imageSrc}
                  onChange={(event) => setDraft((current) => ({ ...current, imageSrc: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm font-semibold text-zinc-800">
                Image Alt
                <input
                  value={draft.imageAlt}
                  onChange={(event) => setDraft((current) => ({ ...current, imageAlt: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-sm font-semibold text-zinc-800 sm:col-span-2">
                Read More URL
                <input
                  value={draft.readMoreUrl}
                  onChange={(event) => setDraft((current) => ({ ...current, readMoreUrl: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-zinc-800">Tags</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newTagInput}
                    onChange={(event) => setNewTagInput(event.target.value)}
                    placeholder="new-tag"
                    className="w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (addTagValue("tags", newTagInput)) {
                        setNewTagInput("");
                      }
                    }}
                    className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:border-[#2461b8]"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagOptions.map((tag) => {
                    const active = draft.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleArrayValue("tags", tag)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${
                          active
                            ? "border-[#2461b8] bg-[#2461b8] text-white"
                            : "border-[#c5d5e8] bg-white text-zinc-700"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-zinc-800">Story Tags</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={newStoryTagInput}
                    onChange={(event) => setNewStoryTagInput(event.target.value)}
                    placeholder="new-story-tag"
                    className="w-full rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (addTagValue("storyTags", newStoryTagInput)) {
                        setNewStoryTagInput("");
                      }
                    }}
                    className="rounded-lg border border-[#c5d5e8] bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:border-[#2461b8]"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {storyTagOptions.map((tag) => {
                    const active = draft.storyTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleArrayValue("storyTags", tag)}
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${
                          active
                            ? "border-[#2461b8] bg-[#2461b8] text-white"
                            : "border-[#c5d5e8] bg-white text-zinc-700"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-[#c5d5e8] bg-[#f8fbff] p-3">
                <p className="text-sm font-semibold text-zinc-800">Pinned Views</p>
                <p className="mt-1 text-xs text-[#4e6378]">
                  Pin this update to the top of selected views. Default view applies when no story tag is selected.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPinInDefaultView((current) => !current)}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                      pinInDefaultView
                        ? "border-[#2461b8] bg-[#2461b8] text-white"
                        : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#2461b8]"
                    }`}
                    title={pinInDefaultView ? "Pinned to default view" : "Pin to default view"}
                  >
                    {pinInDefaultView ? "Pinned: " : ""}default view
                  </button>
                  {storyTagOptions.map((tag) => {
                    const isPinned = pinnedForStories.includes(tag);
                    return (
                      <button
                        key={`pin-${tag}`}
                        type="button"
                        onClick={() => {
                          setPinnedForStories((current) =>
                            current.includes(tag)
                              ? current.filter((t) => t !== tag)
                              : [...current, tag]
                          );
                        }}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                          isPinned
                            ? "border-[#06dbba] bg-[#06dbba] text-white"
                            : "border-[#c5d5e8] bg-white text-zinc-700 hover:border-[#06dbba]"
                        }`}
                        title={isPinned ? `Pinned to ${tag}` : `Pin to ${tag}`}
                      >
                        {isPinned ? "Pinned: " : ""}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
