"use client";

import { useState, useRef } from "react";

interface ParsedReferee {
  first_name: string;
  last_name: string;
  email: string;
}

interface InviteResult {
  email: string;
  status: "invited" | "already_exists" | "error";
  detail?: string;
  invite_link?: string;
}

function parseCSV(text: string): ParsedReferee[] {
  const lines = text.trim().split(/\r?\n/);
  const start = /first|name/i.test(lines[0]) ? 1 : 0;
  return lines.slice(start).flatMap((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [first_name, last_name, email] = cols;
    if (!first_name || !last_name || !email) return [];
    return [{ first_name, last_name, email }];
  });
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-3 px-3 py-1 rounded-lg text-xs font-medium border transition-colors"
      style={copied
        ? { backgroundColor: "#007239", color: "#fff", borderColor: "#007239" }
        : { backgroundColor: "#f8faf9", color: "#002e23", borderColor: "#e2e8e5" }}
    >
      {copied ? "✓ Copied!" : "Copy invite link"}
    </button>
  );
}

export default function InviteRefereesPage() {
  const [parsed, setParsed] = useState<ParsedReferee[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Admin invite form state
  const [adminForm, setAdminForm] = useState({ first_name: "", last_name: "", email: "" });
  const [adminSending, setAdminSending] = useState(false);
  const [adminResult, setAdminResult] = useState<InviteResult | null>(null);

  const handleAdminInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSending(true);
    setAdminResult(null);
    const res = await fetch("/api/invite-referees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referees: [adminForm], role: "admin" }),
    });
    const data = await res.json();
    const r = data.results?.[0];
    setAdminResult(r ?? { status: "error", detail: "Unknown error" });
    if (r?.status === "invited") setAdminForm({ first_name: "", last_name: "", email: "" });
    setAdminSending(false);
  };

  const handleFile = (file: File) => {
    setParseError(null);
    setResults(null);
    setParsed(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          setParseError("No valid rows found. Make sure columns are: First Name, Last Name, Email");
          return;
        }
        setParsed(rows);
      } catch {
        setParseError("Could not parse file. Save your spreadsheet as CSV and try again.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSend = async () => {
    if (!parsed) return;
    setSending(true);
    const res = await fetch("/api/invite-referees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referees: parsed }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setSending(false);
  };

  const invited = results?.filter((r) => r.status === "invited") ?? [];
  const existing = results?.filter((r) => r.status === "already_exists").length ?? 0;
  const errors = results?.filter((r) => r.status === "error") ?? [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#002e23] mb-1">Invite Users</h1>
      <p className="text-sm text-[#6b7c75] mb-8">
        Invite squad coaches as admins, or bulk-invite referees via CSV.
      </p>

      {/* ── Invite Admin ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ffe600", color: "#002e23" }}>Admin</span>
          <h2 className="font-semibold text-[#002e23]">Invite a Squad Coach</h2>
        </div>
        <p className="text-sm text-[#6b7c75] mb-4">Admins have full access — uploading games, managing the roster, and viewing all referee data.</p>
        <form onSubmit={handleAdminInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#002e23] mb-1">First Name</label>
            <input type="text" required value={adminForm.first_name} onChange={e => setAdminForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Sarah" className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#002e23] mb-1">Last Name</label>
            <input type="text" required value={adminForm.last_name} onChange={e => setAdminForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Mitchell" className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#002e23] mb-1">Email</label>
            <input type="email" required value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
              placeholder="sarah@example.com" className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]" />
          </div>
          <div className="sm:col-span-3 flex items-center gap-4 flex-wrap">
            <button type="submit" disabled={adminSending}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#002e23" }}>
              {adminSending ? "Generating…" : "Generate Admin Invite Link"}
            </button>
            {adminResult?.status === "invited" && adminResult.invite_link && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-[#007239] font-medium">✓ Link ready — send this to them:</p>
                <CopyLinkButton link={adminResult.invite_link} />
              </div>
            )}
            {adminResult?.status === "already_exists" && <p className="text-sm text-[#6b7c75]">Already has an account.</p>}
            {adminResult?.status === "error" && <p className="text-sm text-red-600">{adminResult.detail ?? "Failed to generate invite."}</p>}
          </div>
        </form>
      </div>

      <h2 className="font-semibold text-[#002e23] mb-1">Invite Referees</h2>
      <p className="text-sm text-[#6b7c75] mb-6">
        Upload a CSV with three columns — First Name, Last Name, Email. An invite link will be generated for each referee — copy and send it to them directly.
      </p>

      {/* Drop zone */}
      <div
        className="bg-white rounded-xl border-2 border-dashed border-[#e2e8e5] p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[#007239] transition-colors mb-6"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <span className="text-3xl">📄</span>
        {fileName ? (
          <p className="text-sm font-medium text-[#007239]">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-[#002e23]">Drop CSV file here or click to browse</p>
            <p className="text-xs text-[#6b7c75]">Columns: First Name, Last Name, Email</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {parseError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{parseError}</div>
      )}

      {/* Preview table */}
      {parsed && !results && (
        <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-[#e2e8e5] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[#002e23]">Preview</h2>
              <p className="text-xs text-[#6b7c75] mt-0.5">{parsed.length} referee{parsed.length !== 1 ? "s" : ""} found</p>
            </div>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#007239" }}
            >
              {sending ? "Generating links…" : `Generate ${parsed.length} invite link${parsed.length !== 1 ? "s" : ""}`}
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                <th className="text-left px-5 py-3">First Name</th>
                <th className="text-left px-5 py-3">Last Name</th>
                <th className="text-left px-5 py-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((r, i) => (
                <tr key={i} className="border-b border-[#e2e8e5] last:border-0">
                  <td className="px-5 py-3 text-[#002e23]">{r.first_name}</td>
                  <td className="px-5 py-3 text-[#002e23]">{r.last_name}</td>
                  <td className="px-5 py-3 text-[#6b7c75]">{r.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {invited.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e2e8e5]">
                <p className="font-semibold text-[#002e23]">
                  {invited.length} invite link{invited.length !== 1 ? "s" : ""} generated
                  {existing > 0 ? ` · ${existing} already had an account` : ""}
                </p>
                <p className="text-xs text-[#6b7c75] mt-0.5">Copy each link and send it directly to the referee — by text, email, or WhatsApp.</p>
              </div>
              <ul className="divide-y divide-[#e2e8e5]">
                {invited.map((r, i) => (
                  <li key={i} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-sm font-medium text-[#002e23]">{r.email}</span>
                    {r.invite_link && <CopyLinkButton link={r.invite_link} />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {existing > 0 && invited.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-sm text-green-700">{existing} already had an account — no new links needed.</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-200">
                <p className="text-sm font-semibold text-red-800">{errors.length} error{errors.length !== 1 ? "s" : ""}</p>
              </div>
              <ul className="divide-y divide-red-100">
                {errors.map((r, i) => (
                  <li key={i} className="px-5 py-3 text-sm">
                    <span className="font-medium text-red-800">{r.email}</span>
                    {r.detail && <span className="text-red-600 ml-2">— {typeof r.detail === "string" ? r.detail : JSON.stringify(r.detail)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => { setParsed(null); setResults(null); setFileName(null); }}
            className="text-sm text-[#6b7c75] hover:text-[#002e23] underline"
          >
            Upload another file
          </button>
        </div>
      )}

      {/* Format guide */}
      {!parsed && !results && (
        <div className="bg-[#f8faf9] border border-[#e2e8e5] rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7c75] mb-3">Expected format</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b7c75]">
                <th className="text-left py-1 pr-6">First Name</th>
                <th className="text-left py-1 pr-6">Last Name</th>
                <th className="text-left py-1">Email</th>
              </tr>
            </thead>
            <tbody className="text-[#002e23]">
              <tr><td className="py-1 pr-6">Sarah</td><td className="py-1 pr-6">Mitchell</td><td className="py-1">sarah.mitchell@email.com</td></tr>
              <tr><td className="py-1 pr-6">James</td><td className="py-1 pr-6">Nguyen</td><td className="py-1">james.nguyen@email.com</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-[#6b7c75] mt-3">Save your Excel file as CSV (comma-separated) before uploading. A header row is optional.</p>
        </div>
      )}
    </div>
  );
}
