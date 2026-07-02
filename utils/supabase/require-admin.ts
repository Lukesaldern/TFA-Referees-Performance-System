import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * Returns { ok: true, supabase, userId } if the caller is a logged-in admin.
 * Returns { ok: false, response } with a 401/403 if not.
 *
 * Usage:
 *   const auth = await requireAdmin();
 *   if (!auth.ok) return auth.response;
 *   const { supabase, userId } = auth;
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
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
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const, supabase, userId: user.id };
}
