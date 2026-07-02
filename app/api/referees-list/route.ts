import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("referees")
    .select("id, full_name")
    .order("full_name");
  return NextResponse.json(data ?? []);
}
