import { NextResponse } from "next/server";
import {
  listContentUpdates,
  parseAndValidateUpdate,
  updateExists,
  writeContentUpdate,
} from "@/lib/content-store";

export async function GET() {
  try {
    const updates = await listContentUpdates();
    return NextResponse.json({ updates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list updates." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const update = parseAndValidateUpdate(payload);
    if (await updateExists(update.id)) {
      return NextResponse.json({ error: `Update \"${update.id}\" already exists.` }, { status: 409 });
    }

    await writeContentUpdate(update);
    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create update." },
      { status: 400 },
    );
  }
}
