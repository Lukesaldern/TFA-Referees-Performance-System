import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { game_id } = await request.json();

  if (!game_id) return NextResponse.json({ error: "game_id required" }, { status: 400 });

  // Cascade deletes decisions + labels via FK
  const { error } = await supabase.from("games").delete().eq("id", game_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_id: null,
    action: "game_deleted",
    detail: { game_id },
  });

  return NextResponse.json({ success: true });
}
