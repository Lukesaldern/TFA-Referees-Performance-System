import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("id, name, game_date, source_file, uploaded_at, events(name)")
    .order("uploaded_at", { ascending: false });
  return NextResponse.json(data ?? []);
}
