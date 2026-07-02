import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/confirm", "/auth/set-password", "/api/"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: referee } = await supabase
    .from("referees")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = referee?.role ?? "referee";
  const refereeId = referee?.id;

  if (role === "referee") {
    const restricted =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard/squad") ||
      pathname.startsWith("/dashboard/game") ||
      pathname === "/dashboard/referee" ||
      pathname === "/";

    if (restricted) {
      return NextResponse.redirect(
        new URL(refereeId ? `/dashboard/referee/${refereeId}` : "/login", request.url)
      );
    }

    const ownDashboardMatch = pathname.match(/^\/dashboard\/referee\/([^/]+)/);
    if (ownDashboardMatch && ownDashboardMatch[1] !== refereeId) {
      return NextResponse.redirect(
        new URL(refereeId ? `/dashboard/referee/${refereeId}` : "/login", request.url)
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
