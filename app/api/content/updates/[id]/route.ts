import { NextResponse } from "next/server";
import {
  assertValidId,
  deleteContentUpdate,
  parseAndValidateUpdate,
  updateExists,
  writeContentUpdate,
} from "@/lib/content-store";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const normalizedId = assertValidId(id);
    if (!(await updateExists(normalizedId))) {
      return NextResponse.json({ error: `Update \"${normalizedId}\" was not found.` }, { status: 404 });
    }

    const payload = await request.json();
    const parsed = parseAndValidateUpdate(payload);
    if (parsed.id !== normalizedId) {
      return NextResponse.json({ error: "Id in URL must match id in payload." }, { status: 400 });
    }

    await writeContentUpdate(parsed);
    return NextResponse.json({ update: parsed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update content." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const normalizedId = assertValidId(id);
    if (!(await updateExists(normalizedId))) {
      return NextResponse.json({ error: `Update \"${normalizedId}\" was not found.` }, { status: 404 });
    }

    await deleteContentUpdate(normalizedId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete content." },
      { status: 400 },
    );
  }
}
