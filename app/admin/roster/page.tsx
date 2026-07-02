"use client";

import { useState, useEffect, useCallback } from "react";

interface Referee {
  id: string;
  full_name: string;
  email: string | null;
  squad: string | null;
  accreditation: string | null;
  role: string;
}

const SQUADS = ["NRS", "State", "National Youth", "Alliance Squad", "Regional", "Development"];
const ACCREDITATIONS = ["Level 1", "Level 2", "Level 3", "National"];

export default function RosterPage() {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add form state
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    squad: "",
    accreditation: "",
  });

  const fetchReferees = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/roster");
    if (res.ok) setReferees(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchReferees(); }, [fetchReferees]);

  const flash = (msg: string, type: "success" | "error") => {
    if (type === "success") { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
    else { setError(msg); setTimeout(() => setError(null), 4000); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`${form.full_name} added to roster`, "success");
      setForm({ full_name: "", email: "", squad: "", accreditation: "" });
      await fetchReferees();
    } else {
      flash(data.error ?? "Failed to add referee", "error");
    }
    setSaving(false);
  };

  const handleDelete = async (referee: Referee) => {
    if (!confirm(`Remove ${referee.full_name} from the roster? This cannot be undone.`)) return;
    setDeletingId(referee.id);
    const res = await fetch("/api/roster", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: referee.id }),
    });
    if (res.ok) {
      flash(`${referee.full_name} removed`, "success");
      await fetchReferees();
    } else {
      const data = await res.json();
      flash(data.error ?? "Failed to remove", "error");
    }
    setDeletingId(null);
  };

  const handleUpdate = async (id: string, field: string, value: string) => {
    await fetch("/api/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [field]: value || null }),
    });
    setReferees((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value || null } : r));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <h1 className="text-2xl font-bold text-[#002e23] mb-2">Referee Roster</h1>
      <p className="text-sm text-[#6b7c75] mb-8">Add, remove, and update referees on the platform.</p>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">{success}</div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add referee form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-[#e2e8e5] p-5">
            <h2 className="font-semibold text-[#002e23] mb-4">Add Referee</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#002e23] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Zac Genrich"
                  className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#002e23] mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="zac@example.com"
                  className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                />
                <p className="text-xs text-[#6b7c75] mt-1">Optional — add later to invite them to log in</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#002e23] mb-1">Squad</label>
                <select
                  value={form.squad}
                  onChange={(e) => setForm((f) => ({ ...f, squad: e.target.value }))}
                  className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                >
                  <option value="">— none —</option>
                  {SQUADS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#002e23] mb-1">Accreditation</label>
                <select
                  value={form.accreditation}
                  onChange={(e) => setForm((f) => ({ ...f, accreditation: e.target.value }))}
                  className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                >
                  <option value="">— none —</option>
                  {ACCREDITATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: "#007239" }}
              >
                {saving ? "Adding…" : "Add to Roster"}
              </button>
            </form>
          </div>
        </div>

        {/* Roster table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e2e8e5] flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[#002e23]">Current Roster</h2>
                <p className="text-xs text-[#6b7c75]">{referees.length} referee{referees.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {loading ? (
              <div className="px-5 py-12 text-center text-[#6b7c75] text-sm">Loading…</div>
            ) : referees.length === 0 ? (
              <div className="px-5 py-12 text-center text-[#6b7c75] text-sm">No referees yet.</div>
            ) : (
              <div className="divide-y divide-[#e2e8e5]">
                {referees.map((r) => (
                  <div key={r.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold text-[#002e23]">{r.full_name}</p>
                        <p className="text-xs text-[#6b7c75]">{r.email ?? <span className="italic">No email</span>}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                        className="shrink-0 text-xs px-2 py-1 rounded text-[#ef3b24] border border-[#ef3b24]/30 hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        {deletingId === r.id ? "…" : "Remove"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={r.squad ?? ""}
                        onChange={(e) => handleUpdate(r.id, "squad", e.target.value)}
                        className="border border-[#e2e8e5] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#007239]"
                      >
                        <option value="">No squad</option>
                        {SQUADS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select
                        value={r.accreditation ?? ""}
                        onChange={(e) => handleUpdate(r.id, "accreditation", e.target.value)}
                        className="border border-[#e2e8e5] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#007239]"
                      >
                        <option value="">No accreditation</option>
                        {ACCREDITATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
