import Link from "next/link";
import Image from "next/image";
import NavLinks, { type NavItemDef } from "./NavLinks";

interface Props {
  role: string | null;
  refereeId: string | null;
  userEmail: string | null;
  pathname: string;
}

export default function Sidebar({ role, refereeId, userEmail }: Props) {
  const isAdmin = role === "admin";

  const navItems: NavItemDef[] = isAdmin
    ? [
        { href: "/dashboard/squad", label: "Squad Overview", iconName: "squad" },
        { href: "/dashboard/game", label: "Game Analysis", iconName: "game" },
        { href: "/dashboard/referee", label: "Referee Profiles", iconName: "referee" },
      ]
    : refereeId
    ? [
        { href: `/dashboard/referee/${refereeId}`, label: "Referee Profile", iconName: "referee" },
        { href: "/dashboard/game", label: "Game Analysis", iconName: "game" },
      ]
    : [];

  const adminItems: NavItemDef[] = isAdmin
    ? [
        { href: "/admin/roster", label: "Manage Roster", iconName: "roster" },
        { href: "/admin/upload", label: "Ingest XML", iconName: "upload" },
        { href: "/admin/invite", label: "Invite Users", iconName: "invite" },
      ]
    : [];

  const navContent = (
    <>
      <div className="px-4 pt-6 pb-5 border-b border-white/10">
        <Image
          src="/tfa-badge.svg"
          alt="Touch Football Australia"
          width={180}
          height={52}
          priority
        />
        <p className="text-[10px] uppercase tracking-widest mt-3" style={{ color: "#ffe600" }}>
          Referee Performance
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-widest px-3 mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
          Dashboards
        </p>
        <NavLinks items={navItems} />

        {adminItems.length > 0 && (
          <div className="pt-4">
            <p className="text-[10px] uppercase tracking-widest px-3 mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              Admin
            </p>
            <NavLinks items={adminItems} />
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 space-y-2">
        {userEmail && (
          <p className="text-[11px] text-white/50 truncate" title={userEmail}>{userEmail}</p>
        )}
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="w-full text-left text-xs text-white/40 hover:text-white/80 transition-colors py-1">
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        #mobile-nav {
          position: fixed;
          top: 0;
          left: 0;
          height: 100%;
          width: 288px;
          display: flex;
          flex-direction: column;
          z-index: 50;
          background-color: #002e23;
          transform: translateX(-100%);
          transition: transform 300ms ease-in-out;
        }
        #mobile-nav:target {
          transform: translateX(0);
        }
        #mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(0,0,0,0.5);
        }
        #mobile-nav:target ~ #mobile-overlay {
          display: block;
        }
        .nav-item {
          transition: background-color 150ms ease, color 150ms ease;
        }
        .nav-item:hover {
          background-color: rgba(255,230,0,0.1) !important;
          color: #ffe600 !important;
        }
        .nav-item:active {
          animation: nav-flash 400ms ease forwards;
        }
        @keyframes nav-flash {
          0%   { background-color: rgba(255,230,0,0.5); color: #002e23; }
          60%  { background-color: rgba(255,230,0,0.25); color: #ffe600; }
          100% { background-color: rgba(255,230,0,0.15); color: #ffe600; }
        }
      `}</style>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex fixed top-0 left-0 h-full w-56 flex-col z-20"
        style={{ backgroundColor: "#002e23" }}
      >
        {navContent}
      </aside>

      {/* Mobile top bar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 h-14"
        style={{ backgroundColor: "#002e23" }}
      >
        <a href="#mobile-nav" aria-label="Open menu" style={{ color: "#ffe600", padding: "4px", marginLeft: "-4px", display: "flex", alignItems: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect y="5" width="24" height="2" rx="1" fill="currentColor"/>
            <rect y="11" width="24" height="2" rx="1" fill="currentColor"/>
            <rect y="17" width="24" height="2" rx="1" fill="currentColor"/>
          </svg>
        </a>
        <span className="text-sm font-semibold tracking-wide" style={{ color: "#ffe600" }}>
          TFA Referee Performance
        </span>
      </div>

      {/* Mobile drawer — CSS :target driven */}
      <div id="mobile-nav">
        <div className="flex items-center justify-end px-4 pt-4 pb-2">
          <a href="#" aria-label="Close menu" style={{ color: "rgba(255,255,255,0.6)", display: "flex", padding: "4px" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 2L18 18M18 2L2 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </a>
        </div>
        {navContent}
      </div>

      {/* Overlay — closes drawer when clicked */}
      <a href="#" id="mobile-overlay" aria-label="Close menu" />

      {/* Spacer for mobile top bar */}
      <div className="lg:hidden h-14" />
    </>
  );
}
