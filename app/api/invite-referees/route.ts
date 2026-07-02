import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

interface RefereeRow {
  first_name: string;
  last_name: string;
  email: string;
}

function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && !configured.includes("localhost")) return configured;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return configured ?? "";
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { referees, role = "referee" }: { referees: RefereeRow[]; role?: string } = await req.json();

  if (!Array.isArray(referees) || referees.length === 0) {
    return NextResponse.json({ error: "No referees provided" }, { status: 400 });
  }

  const siteUrl = getSiteUrl();
  const redirectTo = `${siteUrl}/auth/confirm?next=/auth/set-password`;

  const results: Array<{
    email: string;
    status: "invited" | "already_exists" | "error";
    detail?: string;
    invite_link?: string;
  }> = [];

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
    const { data: existingUserData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existingUserData?.users.find((u) => u.email?.toLowerCase() === email);

    if (existingUser) {
      await supabaseAdmin.from("referees").upsert(
        { full_name, email, role, auth_user_id: existingUser.id },
        { onConflict: "email" }
      );
      results.push({ email, status: "already_exists" });
      continue;
    }

    // Generate invite link directly — no SMTP required, admin sends the link manually
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo },
    });

    if (linkError || !linkData) {
      const err = linkError as Record<string, unknown> | null;
      const detail = err
        ? (Object.getOwnPropertyDescriptor(err, "message")?.value as string) ||
          `status=${err.status} code=${err.code}`
        : "Failed to generate invite link";
      results.push({ email, status: "error", detail });
      continue;
    }

    // Upsert referee record linked to new auth user
    await supabaseAdmin.from("referees").upsert(
      { full_name, email, role, auth_user_id: linkData.user.id },
      { onConflict: "email" }
    );

    results.push({
      email,
      status: "invited",
      invite_link: linkData.properties.action_link,
    });
  }

  return NextResponse.json({ results });
}
