import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

interface RefereeRow {
  first_name: string;
  last_name: string;
  email: string;
}

export async function POST(req: Request) {
  // Only authenticated admins can send invites
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { referees, role = "referee" }: { referees: RefereeRow[]; role?: string } = await req.json();

  if (!Array.isArray(referees) || referees.length === 0) {
    return NextResponse.json({ error: "No referees provided" }, { status: 400 });
  }

  const results: Array<{ email: string; status: "invited" | "already_exists" | "error"; detail?: string }> = [];

  for (const row of referees) {
    const email = row.email?.trim().toLowerCase();
    const first = row.first_name?.trim();
    const last = row.last_name?.trim();
    const full_name = `${first} ${last}`.trim();

    if (!email || !full_name) {
      results.push({ email: email ?? "(missing)", status: "error", detail: "Missing name or email" });
      continue;
    }

    // Check if auth user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u) => u.email === email);

    if (existingUser) {
      // Ensure referee record is linked
      await supabaseAdmin.from("referees").upsert(
        { full_name, email, role, auth_user_id: existingUser.id },
        { onConflict: "email" }
      );
      results.push({ email, status: "already_exists" });
      continue;
    }

    // Create auth user via invite (Supabase sends the invite email)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/auth/set-password`,
    });

    if (inviteError) {
      results.push({ email, status: "error", detail: inviteError.message });
      continue;
    }

    // Upsert referee record linked to new auth user
    await supabaseAdmin.from("referees").upsert(
      { full_name, email, role, auth_user_id: inviteData.user.id },
      { onConflict: "email" }
    );

    results.push({ email, status: "invited" });
  }

  return NextResponse.json({ results });
}
