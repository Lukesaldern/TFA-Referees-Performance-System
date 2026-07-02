"use client";

import { useState, useEffect, useCallback } from "react";

const PREDEFINED_EVENTS = [
  "The Championships",
  "National Youth Championships",
  "NSW State Cup",
  "QLD State Cup",
  "Metro Cup",
  "Vawdon Cup",
];

interface Game {
  id: string;
  name: string;
  game_date: string | null;
  source_file: string;
  uploaded_at: string;
  events: { name: string } | null;
}

interface UploadResult {
  game_id: string;
  decisions_imported: number;
  coded_names: string[];
  unknown_groups: Array<{ raw: string; instance_id: number }>;
  message: string;
}

interface Referee {
  id: string;
  full_name: string;
}

export default function UploadGamePage() {
  const [file, setFile] = useState<File | null>(null);
  const [eventBase, setEventBase] = useState(PREDEFINED_EVENTS[0]);
  const [eventYear, setEventYear] = useState(new Date().getFullYear().toString());
  const [gameName, setGameName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [hudlLink, setHudlLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [referees, setReferees] = useState<Referee[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());

  const [games, setGames] = useState<Game[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const eventName = `${eventBase} ${eventYear}`.trim();

  const fetchGames = useCallback(async () => {
    const res = await fetch("/api/games-list");
    if (res.ok) setGames(await res.json());
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const fetchReferees = async () => {
    const res = await fetch("/api/referees-list");
    if (res.ok) setReferees(await res.json());
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !gameName) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("event_name", eventName);
    form.append("game_name", gameName);
    if (gameDate) form.append("game_date", gameDate);
    if (hudlLink) form.append("hudl_link", hudlLink);

    const res = await fetch("/api/upload-game", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Upload failed");
    } else {
      setResult(data);
      await fetchReferees();
      await fetchGames();
      const initial: Record<string, string> = {};
      for (const name of data.coded_names) initial[name] = "";
      setAssignments(initial);
      setConfirmed(new Set());
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFile(null);
    setGameName("");
    setGameDate("");
    setHudlLink("");
    setResult(null);
    setAssignments({});
    setConfirmed(new Set());
    setError(null);
  };

  const handleConfirm = async (codedName: string) => {
    const refereeId = assignments[codedName];
    if (!refereeId || !result) return;
    setConfirming(codedName);
    const res = await fetch("/api/confirm-assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: result.game_id, coded_name: codedName, referee_id: refereeId }),
    });
    if (res.ok) {
      const newConfirmed = new Set(confirmed).add(codedName);
      setConfirmed(newConfirmed);
      // Auto-reset once all coded names are confirmed
      if (newConfirmed.size === result.coded_names.length) {
        setTimeout(resetForm, 600);
      }
    }
    setConfirming(null);
  };

  const handleDelete = async (gameId: string) => {
    if (!confirm("Delete this game and all its decisions? This cannot be undone.")) return;
    setDeletingId(gameId);
    await fetch("/api/delete-game", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId }),
    });
    await fetchGames();
    setDeletingId(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#002e23] mb-8">Upload Game XML</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload form */}
        <div>
          <div className="bg-white rounded-xl border border-[#e2e8e5] p-6">
            <h2 className="font-semibold text-[#002e23] mb-5">New Game</h2>
            <form onSubmit={handleUpload} className="space-y-4">

              {/* Event selection */}
              <div>
                <label className="block text-sm font-medium text-[#002e23] mb-1">Event</label>
                <div className="flex gap-2">
                  <select
                    value={eventBase}
                    onChange={(e) => setEventBase(e.target.value)}
                    className="flex-1 border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                  >
                    {PREDEFINED_EVENTS.map((ev) => (
                      <option key={ev} value={ev}>{ev}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={eventYear}
                    onChange={(e) => setEventYear(e.target.value)}
                    placeholder="2026"
                    maxLength={4}
                    className="w-20 border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#007239]"
                  />
                </div>
                <p className="text-xs text-[#6b7c75] mt-1">
                  Event: <span className="font-medium text-[#002e23]">{eventName}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#002e23] mb-1">Game Name</label>
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="e.g. MO TT G1, Open Mixed Semi Final"
                  required
                  className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#002e23] mb-1">Game Date</label>
                  <input
                    type="date"
                    value={gameDate}
                    onChange={(e) => setGameDate(e.target.value)}
                    className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#002e23] mb-1">Hudl Link</label>
                  <input
                    type="url"
                    value={hudlLink}
                    onChange={(e) => setHudlLink(e.target.value)}
                    placeholder="https://hudl.com/..."
                    className="w-full border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239]"
                  />
                </div>
              </div>

              {/* Drop zone */}
              <div>
                <label className="block text-sm font-medium text-[#002e23] mb-1">Sportscode XML File</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#e2e8e5] rounded-xl cursor-pointer hover:border-[#007239] hover:bg-[#f8faf9] transition-colors">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl">↑</span>
                    {file ? (
                      <span className="text-sm font-medium text-[#007239]">{file.name}</span>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-[#002e23]">Drag and drop XML file here</span>
                        <span className="text-xs text-[#6b7c75]">or click to browse</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !file}
                className="w-full rounded-lg px-4 py-2.5 font-medium text-white transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "#002e23" }}
              >
                {loading ? "Processing…" : "Upload & Import"}
              </button>
            </form>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
            )}

            {result && (
              <div className="mt-4 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                  <p className="font-medium text-green-800">{result.message}</p>
                  <p className="text-green-700 mt-0.5">{result.decisions_imported} decisions imported</p>
                  {result.unknown_groups.length > 0 && (
                    <p className="text-amber-600 mt-1 text-xs">{result.unknown_groups.length} unrecognised label group(s) logged</p>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#002e23] mb-2">Confirm Referee Assignments</h3>
                  <div className="space-y-2">
                    {result.coded_names.map((name) => (
                      <div key={name} className="flex items-center gap-2 p-3 border border-[#e2e8e5] rounded-lg bg-[#f8faf9]">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[#002e23] truncate">{name}</p>
                        </div>
                        <select
                          value={assignments[name] ?? ""}
                          onChange={(e) => setAssignments((prev) => ({ ...prev, [name]: e.target.value }))}
                          disabled={confirmed.has(name)}
                          className="border border-[#e2e8e5] rounded px-2 py-1 text-xs min-w-36"
                        >
                          <option value="">— select —</option>
                          {referees.map((r) => (
                            <option key={r.id} value={r.id}>{r.full_name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleConfirm(name)}
                          disabled={!assignments[name] || confirmed.has(name) || confirming === name}
                          className="rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                          style={{ backgroundColor: confirmed.has(name) ? "#007239" : "#002e23" }}
                        >
                          {confirmed.has(name) ? "✓" : confirming === name ? "…" : "Confirm"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Game database */}
        <div>
          <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#e2e8e5] flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-[#002e23]">Ingested Games</h2>
                <p className="text-xs text-[#6b7c75]">{games.length} game{games.length !== 1 ? "s" : ""} in database</p>
              </div>
            </div>

            {games.length === 0 ? (
              <div className="px-5 py-12 text-center text-[#6b7c75] text-sm">
                No games uploaded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#e2e8e5]">
                {games.map((g) => (
                  <div key={g.id} className="px-5 py-4 flex items-start justify-between gap-3 hover:bg-[#f8faf9]">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#002e23]">{g.name}</p>
                      <p className="text-xs text-[#6b7c75] mt-0.5">
                        {g.events?.name ?? "Unknown event"}
                        {g.game_date ? ` · ${new Date(g.game_date).toLocaleDateString("en-AU")}` : ""}
                      </p>
                      <p className="text-xs text-[#6b7c75] font-mono mt-0.5 truncate">{g.source_file}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(g.id)}
                      disabled={deletingId === g.id}
                      className="shrink-0 p-2 rounded-lg text-[#ef3b24] hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Delete game"
                    >
                      {deletingId === g.id ? "…" : "🗑"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 bg-[#f8faf9] border border-[#e2e8e5] rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7c75] mb-2">Ingestion Guidelines</p>
            <ul className="text-xs text-[#6b7c75] space-y-1 list-disc ml-4">
              <li>One XML file per game</li>
              <li>Re-uploading the same filename for the same event replaces existing data</li>
              <li>Confirm referee assignments after each upload to link decisions to the roster</li>
              <li>Label group typos (e.g. PENATLY) are auto-corrected on import</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
