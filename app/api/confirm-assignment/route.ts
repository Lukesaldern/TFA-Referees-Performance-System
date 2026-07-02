import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

// POST body: { game_id, coded_name, referee_id }
// Confirms a coded XML name → roster referee mapping and backfills referee_id on decisions
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth;

  const { game_id, coded_name, referee_id } = await request.json();
  if (!game_id || !coded_name || !referee_id) {
    return NextResponse.json({ error: "game_id, coded_name, and referee_id are required" }, { status: 400 });
  }

  // Update the assignment
  const { error: assignError } = await supabase
    .from("referee_game_assignments")
    .update({ referee_id, confirmed_by: userId, confirmed_at: new Date().toISOString() })
    .eq("game_id", game_id)
    .eq("coded_name", coded_name);

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });

  // Re-parse the stored XML to find which instance_ids belong to this coded name
  const { data: gameRow } = await supabase
    .from("games")
    .select("raw_xml")
    .eq("id", game_id)
    .single();

  if (gameRow?.raw_xml) {
    const { parseSportsCodeXml } = await import("@/lib/parse-xml");
    const encoded = new TextEncoder().encode(gameRow.raw_xml);
    const { decisions } = parseSportsCodeXml(encoded.buffer);
    const instanceIds = decisions
      .filter((d) => d.referee_names.includes(coded_name))
      .map((d) => d.instance_id);

    if (instanceIds.length > 0) {
      await supabase
        .from("decisions")
        .update({ referee_id })
        .eq("game_id", game_id)
        .in("instance_id", instanceIds);
    }
  }

  // Audit
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "name_confirmed",
    detail: { game_id, coded_name, referee_id },
  });

  return NextResponse.json({ success: true });
}
