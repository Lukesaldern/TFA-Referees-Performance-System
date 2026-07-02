import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { supabase } = auth;

  const { game_id } = await request.json();

  if (!game_id) return NextResponse.json({ error: "game_id required" }, { status: 400 });

  // Cascade deletes decisions + labels via FK
  const { error } = await supabase.from("games").delete().eq("id", game_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("audit_log").insert({
    actor_id: auth.user.id,
    action: "game_deleted",
    detail: { game_id },
  });

  return NextResponse.json({ success: true });
}
