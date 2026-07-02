import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data } = await auth.supabase
    .from("games")
    .select("id, name, game_date, source_file, uploaded_at, events(name)")
    .order("uploaded_at", { ascending: false });
  return NextResponse.json(data ?? []);
}
