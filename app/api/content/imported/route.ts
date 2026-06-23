import { NextResponse } from "next/server";
import { deleteImportedContentUpdates } from "@/lib/content-store";

export async function DELETE() {
  try {
    const deletedCount = await deleteImportedContentUpdates();
    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete imported updates." },
      { status: 500 },
    );
  }
}
