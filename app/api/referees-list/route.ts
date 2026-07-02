import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data } = await auth.supabase
    .from("referees")
    .select("id, full_name")
    .order("full_name");
  return NextResponse.json(data ?? []);
}
