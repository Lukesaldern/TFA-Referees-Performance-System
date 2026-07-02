import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * Returns { supabase, user } if the caller is a logged-in admin.
 * Returns { error: NextResponse } if not — callers should return the error immediately.
 */
export async function requireAdmin(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string }; error?: never }
  | { error: NextResponse; supabase?: never; user?: never }
> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Check referee record for admin role
  const { data: referee } = await supabase
    .from("referees")
    .select("role")
    .eq("auth_user_id", user.id)
    .single();

  if (referee?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, user: { id: user.id } };
}
