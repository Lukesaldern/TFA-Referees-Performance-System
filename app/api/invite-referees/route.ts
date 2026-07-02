import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

interface RefereeRow {
  first_name: string;
  last_name: string;
  email: string;
}

/** Serialize any error object including non-enumerable Error properties */
function serializeError(err: unknown): string {
  if (!err) return "Unknown error";
  const props: Record<string, unknown> = {};
  for (const key of Object.getOwnPropertyNames(err)) {
    props[key] = (err as Record<string, unknown>)[key];
  }
  // Skip the stack trace — just show message, name, status, code
  const { message, name, status, code, error_description, msg } = props as Record<string, string>;
  const parts = [
    message && `message: ${message}`,
    name && name !== "AuthApiError" && `name: ${name}`,
    status && `status: ${status}`,
    code && `code: ${code}`,
    error_description && `desc: ${error_description}`,
    msg && `msg: ${msg}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : JSON.stringify(props);
}

/** Build the site URL — prefer NEXT_PUBLIC_SITE_URL but fall back to Vercel's auto-set URL */
function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && !configured.includes("localhost")) return configured;
  // VERCEL_URL is automatically set by Vercel on every deployment (server-side only)
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return configured ?? "";
}

export async function POST(req: Request) {
  // Only authenticated admins can send invites
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

    // Create auth user via invite (Supabase sends the invite email)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { redirectTo }
    );

    if (inviteError) {
      results.push({ email, status: "error", detail: serializeError(inviteError) });
      continue;
    }

    // Upsert referee record linked to new auth user
    await supabaseAdmin.from("referees").upsert(
      { full_name, email, role, auth_user_id: inviteData.user.id },
      { onConflict: "email" }
    );

    results.push({ email, status: "invited" });
  }

  // Include the redirectTo in response for debugging
  return NextResponse.json({ results, debug_redirectTo: redirectTo });
}
