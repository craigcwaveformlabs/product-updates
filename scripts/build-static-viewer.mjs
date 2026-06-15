import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tempRoot = path.join(root, ".tmp-static-viewer");
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}` : "");

const moves = [
  { from: path.join(root, "app", "api"), to: path.join(tempRoot, "app-api") },
  { from: path.join(root, "proxy.ts"), to: path.join(tempRoot, "proxy.ts") },
];

const performedMoves = [];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function moveIfExists(from, to) {
  if (!fs.existsSync(from)) {
    return;
  }

  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
  performedMoves.push({ from, to });
}

function restoreMoves() {
  for (let index = performedMoves.length - 1; index >= 0; index -= 1) {
    const move = performedMoves[index];
    if (fs.existsSync(move.to)) {
      ensureDir(path.dirname(move.from));
      fs.renameSync(move.to, move.from);
    }
  }

  if (fs.existsSync(tempRoot)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

try {
  for (const move of moves) {
    moveIfExists(move.from, move.to);
  }

  const env = {
    ...process.env,
    STATIC_EXPORT: "true",
    NEXT_PUBLIC_VIEWER_ONLY: "true",
  };

  const nextBin = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(nextBin, ["next", "build"], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  restoreMoves();
}
