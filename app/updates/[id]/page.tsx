import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { updates } from "../../content/updates";

type UpdatePageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return updates.map((update) => ({ id: update.id }));
}

export default async function UpdatePreviewPage({ params }: UpdatePageProps) {
  const { id } = await params;
  const update = updates.find((item) => item.id === id);

  if (!update) {
    notFound();
  }

  const blocks = update.detailBlocks?.length
    ? update.detailBlocks
    : update.detailBody?.map((text) => ({ type: "body" as const, text })) ?? [{ type: "body" as const, text: update.summaryBody }];

  return (
    <div className="brand-shell min-h-screen pb-12">
      <div className="mx-auto mt-8 w-full max-w-5xl px-4">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex rounded-full border border-[#c5d5e8] bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.08em] text-[#1a2e44] transition hover:border-[#2461b8]"
          >
            Back to updates
          </Link>
        </div>

        <article className="brand-panel overflow-hidden rounded-2xl">
          <div className="relative h-[280px] w-full bg-[#eaf2fb] sm:h-[360px]">
            <Image
              src={update.imageSrc}
              alt={update.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 960px"
              unoptimized
            />
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4e6378]">{update.date}</p>
            <h1 className="title-font mt-2 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">{update.title}</h1>
            <p className="mt-4 text-base leading-7 text-zinc-800">{update.summaryBody}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {update.storyTags.map((tag) => (
                <span
                  key={`story-${tag}`}
                  className="rounded-full border border-[#c5d5e8] bg-white px-3 py-1 text-xs font-bold text-zinc-700"
                >
                  Story: {tag}
                </span>
              ))}
              {update.tags.map((tag) => (
                <span
                  key={`tag-${tag}`}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${tag === "coming-soon" ? "bg-[#008cffff] text-white" : "border border-[#b9d7ff] bg-[#edf5ff] text-[#1e4e95]"}`}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-6 space-y-4 text-base leading-7 text-zinc-800">
              {blocks.map((block, index) => {
                if (block.type === "heading-lg") {
                  return (
                    <h2 key={`block-${index}`} className="title-font text-2xl font-extrabold text-zinc-950">
                      {block.text}
                    </h2>
                  );
                }

                if (block.type === "heading-sm") {
                  return (
                    <h3 key={`block-${index}`} className="title-font text-xl font-extrabold text-zinc-900">
                      {block.text}
                    </h3>
                  );
                }

                return <p key={`block-${index}`}>{block.text}</p>;
              })}
            </div>

            <a
              href={update.readMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex rounded-full bg-[#1a4a96] px-4 py-2 text-sm font-extrabold text-white transition hover:bg-[#2461b8]"
            >
              Read on FreeAgent blog
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
