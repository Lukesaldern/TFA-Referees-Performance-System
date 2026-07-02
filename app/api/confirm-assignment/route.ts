import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// POST body: { game_id, coded_name, referee_id }
// Confirms a coded XML name → roster referee mapping and backfills referee_id on decisions
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // TODO Phase 3: re-enable auth check once login is set up
  const { data: { user } } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;

  const { game_id, coded_name, referee_id } = await request.json();
  if (!game_id || !coded_name || !referee_id) {
    return NextResponse.json({ error: "game_id, coded_name, and referee_id are required" }, { status: 400 });
  }

  // Update the assignment
  const { error: assignError } = await supabase
    .from("referee_game_assignments")
    .update({ referee_id, confirmed_by: actorId, confirmed_at: new Date().toISOString() })
    .eq("game_id", game_id)
    .eq("coded_name", coded_name);

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 });

  // Backfill referee_id on all decisions that matched this coded name
  // We need to find decisions for this game where the instance was coded by this name
  // The coded name is stored in referee_game_assignments; decisions don't store the raw name
  // So we match via the assignment and update all unassigned decisions for this game
  // that correspond to this coded_name by re-joining through the XML parse order
  // Simpler: store coded_name on decisions table — but schema avoids that duplication.
  // Instead: after confirm, update all decisions in this game with null referee_id
  // where the coded name matches. We need the coded_name on decisions for this join.
  // For now: update all null-referee decisions in this game to this referee
  // when there's only one unconfirmed name left. Otherwise use instance ranges.
  //
  // Better approach: we need coded_name on decisions. Add it via a migration.
  // For now, use the API to look up which instance_ids belong to this coded name
  // by re-parsing... but we have the raw_xml stored. Use it.

  const { data: gameRow } = await supabase
    .from("games")
    .select("raw_xml")
    .eq("id", game_id)
    .single();

  if (gameRow?.raw_xml) {
    const { parseSportsCodeXml } = await import("@/lib/parse-xml");
    // raw_xml is stored as a string — encode back to ArrayBuffer for the parser
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
    actor_id: actorId,
    action: "name_confirmed",
    detail: { game_id, coded_name, referee_id },
  });

  return NextResponse.json({ success: true });
}
