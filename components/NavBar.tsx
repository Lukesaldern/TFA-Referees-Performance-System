import Link from "next/link";

export default function NavBar() {
  return (
    <nav style={{ backgroundColor: "#002e23" }} className="text-white px-6 py-3 flex items-center gap-6">
      <Link href="/" className="font-bold text-lg tracking-tight" style={{ color: "#ffe600" }}>
        TFA Referee Performance
      </Link>
      <div className="flex gap-4 text-sm ml-4">
        <Link href="/dashboard/squad" className="hover:text-[#ffe600] transition-colors">Squad</Link>
        <Link href="/admin/upload" className="hover:text-[#ffe600] transition-colors">Upload</Link>
      </div>
    </nav>
  );
}
