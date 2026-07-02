import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { createClient } from "@/utils/supabase/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TFA Referee Performance Platform",
  description: "Touch Football Australia — Officiating Performance Analysis",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TFA Referee",
  },
};

export const viewport: Viewport = {
  themeColor: "#002e23",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  let refereeId: string | null = null;

  if (user) {
    const { data: ref } = await supabase
      .from("referees")
      .select("id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    role = ref?.role ?? "referee";
    refereeId = ref?.id ?? null;
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const showSidebar = user && !isAuthPage;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/tfa-badge.svg" />
      </head>
      <body className="min-h-full bg-[#f8faf9]">
        <ServiceWorkerRegistrar />
        {showSidebar && (
          <Sidebar role={role} refereeId={refereeId} userEmail={user?.email ?? null} pathname="" />
        )}
        <main className={showSidebar ? "lg:ml-56 min-h-screen" : "min-h-screen"}>
          {children}
        </main>
      </body>
    </html>
  );
}
