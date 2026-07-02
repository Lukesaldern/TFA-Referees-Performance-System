import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminOk = { ok: true; supabase: SupabaseClient; userId: string };
type AdminFail = { ok: false; response: NextResponse };
export type AdminResult = AdminOk | AdminFail;

/**
 * Returns { ok: true, supabase, userId } if the caller is a logged-in admin.
 * Returns { ok: false, response } with a 401/403 if not.
 * Usage: const auth = await requireAdmin(); if (!auth.ok) return auth.response;
 */
export async function requireAdmin(): Promise<AdminResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: referee } = await supabase
    .from("referees")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (referee?.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, supabase, userId: user.id };
}
