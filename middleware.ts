import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required by Supabase SSR
  const { data: { user } } = await supabase.auth.getUser();

  // Protect all /admin and /dashboard routes — redirect to login if not authenticated
  const isProtected = pathname.startsWith("/admin") || pathname.startsWith("/dashboard");
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Protect API routes that require authentication
  const isProtectedApi =
    pathname.startsWith("/api/invite-referees") ||
    pathname.startsWith("/api/upload-game") ||
    pathname.startsWith("/api/confirm-assignment") ||
    pathname.startsWith("/api/delete-game") ||
    pathname.startsWith("/api/roster") ||
    pathname.startsWith("/api/referees-list") ||
    pathname.startsWith("/api/games-list");

  if (isProtectedApi && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/invite-referees/:path*",
    "/api/upload-game/:path*",
    "/api/confirm-assignment/:path*",
    "/api/delete-game/:path*",
    "/api/roster/:path*",
    "/api/referees-list/:path*",
    "/api/games-list/:path*",
  ],
};
