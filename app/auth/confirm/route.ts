import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  // Validate next to prevent open-redirect attacks — only allow relative paths
  const rawNext = searchParams.get("next") ?? "/dashboard/referee";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard/referee";

  const cookieStore = await cookies();

  // Capture cookies that Supabase sets during auth so we can attach them to the
  // redirect response. NextResponse.redirect() creates a brand-new response object,
  // so cookies written only to cookieStore are lost; we must set them explicitly.
  const pendingCookies: Array<{ name: string; value: string; options: Parameters<typeof cookieStore.set>[2] }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    }
  );

  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  };

  // PKCE flow (magic link)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirect(next);
  }

  // OTP flow (invite)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type: type as "invite" | "magiclink", token_hash });
    if (!error) return redirect(next);
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
