import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/require-admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("referees")
    .select("id, full_name, email, squad, accreditation, role")
    .neq("role", "admin")
    .order("full_name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { full_name, email, squad, accreditation } = body;
  if (!full_name?.trim()) return NextResponse.json({ error: "full_name is required" }, { status: 400 });

  const { data, error } = await auth.supabase
    .from("referees")
    .insert({
      full_name: full_name.trim(),
      email: email?.trim() || null,
      squad: squad || null,
      accreditation: accreditation || null,
      role: "referee",
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed = ["squad", "accreditation", "email", "full_name"];
  const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));

  const { error } = await auth.supabase.from("referees").update(update).eq("id", id).neq("role", "admin");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Safety: don't allow deleting admins
  const { data: ref } = await auth.supabase.from("referees").select("role").eq("id", id).single();
  if (ref?.role === "admin") return NextResponse.json({ error: "Cannot remove admin accounts" }, { status: 403 });

  const { error } = await auth.supabase.from("referees").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
