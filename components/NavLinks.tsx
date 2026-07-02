"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItemDef {
  href: string;
  label: string;
  iconName: string;
}

function Icon({ name }: { name: string }) {
  if (name === "squad") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      <path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
    </svg>
  );
  if (name === "game") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
  if (name === "referee") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4"/>
      <path d="M5.5 21v-2a6 6 0 0 1 6-6h1a6 6 0 0 1 6 6v2"/>
    </svg>
  );
  if (name === "upload") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  );
  if (name === "roster") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  );
  if (name === "invite") return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
  return null;
}

export default function NavLinks({ items }: { items: NavItemDef[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          pathname.startsWith(item.href + "/") ||
          pathname.startsWith(item.href + "?");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              // Programmatically click the overlay anchor (href="#") to clear the hash.
              // history.replaceState doesn't trigger :target CSS updates — only a real
              // hash navigation does, which is what clicking href="#" gives us.
              (document.getElementById("mobile-overlay") as HTMLAnchorElement | null)?.click();
            }}
            className="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
            style={
              isActive
                ? { backgroundColor: "rgba(255,230,0,0.15)", color: "#ffe600" }
                : { color: "rgba(255,255,255,0.65)" }
            }
          >
            <span className="shrink-0"><Icon name={item.iconName} /></span>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
