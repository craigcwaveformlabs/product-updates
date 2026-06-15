import type { NextConfig } from "next";

const isStaticExport = process.env.STATIC_EXPORT === "true";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = isStaticExport && process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}` : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.68.117"],
  ...(isStaticExport
    ? {
        output: "export",
        images: {
          unoptimized: true,
        },
        trailingSlash: true,
        skipTrailingSlashRedirect: true,
        ...(basePath ? { basePath } : {}),
      }
    : {}),
};

export default nextConfig;
