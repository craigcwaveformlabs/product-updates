import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    const root = process.cwd();
    const scriptPath = path.join(root, "scripts", "generate-updates-content.mjs");
    const result = await execFileAsync("node", [scriptPath], { cwd: root });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    return NextResponse.json({ ok: true, output });
  } catch (error) {
    const stderr =
      typeof error === "object" && error && "stderr" in error ? String(error.stderr ?? "") : "";
    const message =
      stderr || (error instanceof Error ? error.message : "Failed to generate content output.");
    return NextResponse.json({ error: message.trim() || "Failed to generate content output." }, { status: 500 });
  }
}
