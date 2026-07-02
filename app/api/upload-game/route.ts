import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { parseSportsCodeXml, decodePossiblyUtf16 } from "@/lib/parse-xml";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const actorId = user?.id ?? null;

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const eventName = form.get("event_name") as string | null;
  const gameName = form.get("game_name") as string | null;
  const gameDate = form.get("game_date") as string | null;
  const hudlLink = form.get("hudl_link") as string | null;

  if (!file || !eventName || !gameName) {
    return NextResponse.json({ error: "file, event_name, and game_name are required" }, { status: 400 });
  }

  // Read as ArrayBuffer so parser can handle UTF-16 encoding
  const buffer = await file.arrayBuffer();
  const { decisions, refereeNames, unknownGroups } = parseSportsCodeXml(buffer);

  if (decisions.length === 0) {
    return NextResponse.json({ error: "No instances found in XML" }, { status: 422 });
  }

  // Look up or create the event by name
  let eventId: string;
  const { data: existingEvent } = await supabase
    .from("events")
    .select("id")
    .eq("name", eventName)
    .maybeSingle();

  if (existingEvent) {
    eventId = existingEvent.id;
  } else {
    const { data: newEvent, error: eventError } = await supabase
      .from("events")
      .insert({ name: eventName })
      .select("id")
      .single();
    if (eventError || !newEvent) {
      return NextResponse.json({ error: eventError?.message ?? "Failed to create event" }, { status: 500 });
    }
    eventId = newEvent.id;
  }

  // Upsert the game record
  const { data: game, error: gameError } = await supabase
    .from("games")
    .upsert(
      {
        event_id: eventId,
        name: gameName,
        game_date: gameDate ?? null,
        source_file: file.name,
        hudl_link: hudlLink ?? null,
        raw_xml: decodePossiblyUtf16(buffer),
        uploaded_by: actorId,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "event_id,source_file" }
    )
    .select("id")
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: gameError?.message ?? "Failed to create game" }, { status: 500 });
  }

  const gameId = game.id;

  // Clear existing decisions for re-upload
  await supabase.from("decisions").delete().eq("game_id", gameId);

  // Insert decisions — one per instance (primary/first referee)
  for (const dec of decisions) {
    const { data: decision, error: decError } = await supabase
      .from("decisions")
      .upsert(
        {
          game_id: gameId,
          referee_id: null,              // set later via confirm-assignment
          instance_id: dec.instance_id,
          start_sec: dec.start_sec,
          end_sec: dec.end_sec,
          instance_note: dec.call_text, // store <code> here for view to use
          flag: 0,
        },
        { onConflict: "game_id,instance_id" }
      )
      .select("id")
      .single();

    if (decError || !decision) continue;

    // Store all labels
    if (dec.labels.length > 0) {
      await supabase.from("decision_labels").delete().eq("decision_id", decision.id);
      await supabase.from("decision_labels").insert(
        dec.labels.map((l) => ({
          decision_id: decision.id,
          group_normalised: l.group_normalised,
          group_raw: l.group_raw,
          text: l.text,
        }))
      );
    }
  }

  // Create referee-game assignment stubs for all referee names found
  for (const name of refereeNames) {
    await supabase
      .from("referee_game_assignments")
      .upsert(
        { game_id: gameId, coded_name: name, referee_id: null, confirmed_by: null, confirmed_at: null },
        { onConflict: "game_id,coded_name", ignoreDuplicates: true }
      );
  }

  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action: "xml_upload",
    detail: {
      game_id: gameId,
      game_name: gameName,
      filename: file.name,
      event_name: eventName,
      decisions_count: decisions.length,
      coded_names: refereeNames,
      unknown_groups: unknownGroups,
    },
  });

  return NextResponse.json({
    game_id: gameId,
    event_id: eventId,
    decisions_imported: decisions.length,
    coded_names: refereeNames,
    unknown_groups: unknownGroups,
    message:
      unknownGroups.length > 0
        ? `Imported with ${unknownGroups.length} unrecognised label group(s)`
        : "Imported successfully",
  });
}
