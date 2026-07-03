import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import AccuracyBar from "@/components/AccuracyBar";
import SquadCharts from "@/components/SquadCharts";
import PositionAccuracyChart from "@/components/PositionAccuracyChart";

export const dynamic = "force-dynamic";

export default async function SquadDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; field?: string; severity?: string; heatmap?: string }>;
}) {
  const { event: eventId, field: fieldFilter, severity: severityFilter, heatmap: heatmapMode } = await searchParams;
  const supabase = await createClient();

  // Fetch all decision rows
  let query = supabase
    .from("decision_accuracy")
    .select("decision_id, referee_id, accuracy, importance, game_id, event_id, call_group, call_text, field_position");
  if (eventId) query = query.eq("event_id", eventId);
  if (fieldFilter) query = query.eq("field_position", fieldFilter);
  if (severityFilter === "critical") query = query.eq("importance", "CRITICAL");
  if (severityFilter === "general") query = query.eq("importance", "GENERAL");
  const { data: rows } = await query;

  // Only show events that have actual decision data
  const activeEventIds = [...new Set((rows ?? []).map((r) => r.event_id).filter(Boolean))];
  const { data: events } =
    activeEventIds.length > 0
      ? await supabase
          .from("events")
          .select("id, name, starts_on")
          .in("id", activeEventIds)
          .order("starts_on", { ascending: false })
      : { data: [] };

  const { data: referees } = await supabase
    .from("referees")
    .select("id, full_name, squad")
    .order("full_name");

  // Per-referee stats
  type RefStats = {
    id: string;
    full_name: string;
    squad: string | null;
    total: number;
    correct: number;
    critical_total: number;
    critical_correct: number;
    general_total: number;
    general_correct: number;
  };

  const statsMap: Record<string, RefStats> = {};
  for (const ref of referees ?? []) {
    statsMap[ref.id] = {
      id: ref.id,
      full_name: ref.full_name,
      squad: ref.squad,
      total: 0,
      correct: 0,
      critical_total: 0,
      critical_correct: 0,
      general_total: 0,
      general_correct: 0,
    };
  }
  for (const row of rows ?? []) {
    if (!row.referee_id || !statsMap[row.referee_id]) continue;
    const s = statsMap[row.referee_id];
    s.total++;
    if (row.accuracy === "Correct") s.correct++;
    if (row.importance === "CRITICAL") {
      s.critical_total++;
      if (row.accuracy === "Correct") s.critical_correct++;
    } else {
      s.general_total++;
      if (row.accuracy === "Correct") s.general_correct++;
    }
  }

  const refStats = Object.values(statsMap)
    .filter((s) => s.total > 0)
    .sort((a, b) => b.correct / b.total - a.correct / a.total);

  const totalDecisions = refStats.reduce((acc, s) => acc + s.total, 0);
  const totalCorrect = refStats.reduce((acc, s) => acc + s.correct, 0);
  const squadOverallPct = totalDecisions > 0 ? Math.round((totalCorrect / totalDecisions) * 100) : 0;

  // Call-type breakdown for chart
  type CallStats = { correct: number; incorrect: number };
  const callMap: Record<string, CallStats> = {};
  for (const row of rows ?? []) {
    if (!row.call_text) continue;
    const label = row.call_text;
    if (!callMap[label]) callMap[label] = { correct: 0, incorrect: 0 };
    if (row.accuracy === "Correct") callMap[label].correct++;
    else callMap[label].incorrect++;
  }
  const callBreakdown = Object.entries(callMap)
    .map(([call, v]) => ({ call, correct: v.correct, incorrect: v.incorrect, total: v.correct + v.incorrect }))
    .sort((a, b) => b.total - a.total);

  // Per-referee data for radar/bar chart
  const refereeChartData = refStats.map((s) => ({
    name: s.full_name.split(" ")[0], // first name for chart labels
    full_name: s.full_name,
    pct: Math.round((s.correct / s.total) * 100),
    correct: s.correct,
    incorrect: s.total - s.correct,
    total: s.total,
  }));

  // Games in scope
  const gameIds = [...new Set((rows ?? []).map((r) => r.game_id).filter(Boolean))];
  const { data: games } =
    gameIds.length > 0
      ? await supabase
          .from("games")
          .select("id, name, game_date, event_id, events(name)")
          .in("id", gameIds)
          .order("game_date")
      : { data: [] };

  const selectedEventName = events?.find((e) => e.id === eventId)?.name;

  // Referee position labels keyed by decision_id, for the position accuracy chart
  const posDecisionIds = [...new Set((rows ?? []).map((r) => r.decision_id).filter(Boolean))];
  const { data: positionRows } = posDecisionIds.length > 0
    ? await supabase
        .from("decision_labels")
        .select("decision_id, text")
        .eq("group_normalised", "REFEREE_POSITION")
        .in("decision_id", posDecisionIds)
    : { data: [] };
  const positionMap = Object.fromEntries((positionRows ?? []).map((p) => [p.decision_id, p.text]));
  const positionData = (rows ?? [])
    .filter((r) => positionMap[r.decision_id])
    .map((r) => ({ call: r.call_text, position: positionMap[r.decision_id], correct: r.accuracy === "Correct" }));

  // Heatmap zone counts (no field filter — field position IS the visualisation)
  let hmQuery = supabase
    .from("decision_accuracy")
    .select("field_position, accuracy, is_missed");
  if (eventId) hmQuery = hmQuery.eq("event_id", eventId);
  if (severityFilter === "critical") hmQuery = hmQuery.eq("importance", "CRITICAL");
  if (severityFilter === "general") hmQuery = hmQuery.eq("importance", "GENERAL");
  const { data: hmRows } = await hmQuery;

  const ZONES = ["Attacking 3rd", "Middle 3rd", "Defensive 3rd"] as const;
  const hmMode = heatmapMode === "incorrect" || heatmapMode === "all" ? heatmapMode : "missed";
  const hmFilter =
    hmMode === "all" ? () => true :
    hmMode === "incorrect"
      ? (r: { accuracy: string; is_missed: boolean }) => r.accuracy === "Incorrect"
      : (r: { accuracy: string; is_missed: boolean }) => r.is_missed;
  const zoneCounts = Object.fromEntries(ZONES.map(z => [z, (hmRows ?? []).filter(r => r.field_position === z && hmFilter(r)).length]));
  // Total calls per zone (all decisions) — denominator for the % readouts
  const zoneTotals = Object.fromEntries(ZONES.map(z => [z, (hmRows ?? []).filter(r => r.field_position === z).length]));
  const maxZoneCount = Math.max(1, ...Object.values(zoneCounts));

  // Build filter URL helpers
  const filterUrl = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (eventId) params.set("event", eventId);
    if (fieldFilter) params.set("field", fieldFilter);
    if (severityFilter) params.set("severity", severityFilter);
    if (heatmapMode) params.set("heatmap", heatmapMode);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    });
    const str = params.toString();
    return `/dashboard/squad${str ? `?${str}` : ""}`;
  };

  const fieldOptions = ["Attacking 3rd", "Middle 3rd", "Defensive 3rd"];
  const severityOptions = [
    { value: "critical", label: "Critical DM" },
    { value: "general", label: "General DM" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002e23]">Squad Overview</h1>
          {selectedEventName && (
            <p className="text-sm text-[#6b7c75] mt-0.5">{selectedEventName}</p>
          )}
        </div>
      </div>

      {/* Event filter pills — only show events with data */}
      <div className="flex gap-2 flex-wrap mb-3">
        <Link
          href="/dashboard/squad"
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            !eventId
              ? "border-transparent text-[#002e23]"
              : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#007239] hover:text-[#007239]"
          }`}
          style={!eventId ? { backgroundColor: "#ffe600" } : {}}
        >
          All Events
        </Link>
        {(events ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/dashboard/squad?event=${e.id}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              eventId === e.id
                ? "border-transparent text-[#002e23]"
                : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#007239] hover:text-[#007239]"
            }`}
            style={eventId === e.id ? { backgroundColor: "#ffe600" } : {}}
          >
            {e.name}
          </Link>
        ))}
      </div>

      {/* Field position + severity filter pills */}
      <div className="flex gap-2 flex-wrap mb-8">
        <Link
          href={filterUrl({ field: undefined })}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!fieldFilter ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#002e23] hover:text-[#002e23]"}`}
          style={!fieldFilter ? { backgroundColor: "#002e23", color: "#fff" } : {}}
        >
          All Zones
        </Link>
        {fieldOptions.map((f) => (
          <Link
            key={f}
            href={filterUrl({ field: f })}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${fieldFilter === f ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#002e23] hover:text-[#002e23]"}`}
            style={fieldFilter === f ? { backgroundColor: "#002e23", color: "#fff" } : {}}
          >
            {f}
          </Link>
        ))}
        <span className="w-px bg-[#e2e8e5] mx-1" />
        <Link
          href={filterUrl({ severity: undefined })}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!severityFilter ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#ef3b24] hover:text-[#ef3b24]"}`}
          style={!severityFilter ? { backgroundColor: "#ffe600", color: "#002e23" } : {}}
        >
          All Severity
        </Link>
        {severityOptions.map((s) => (
          <Link
            key={s.value}
            href={filterUrl({ severity: s.value })}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${severityFilter === s.value ? "border-transparent" : "text-[#6b7c75] border-[#e2e8e5]"}`}
            style={severityFilter === s.value ? { backgroundColor: "#ffe600", color: "#002e23" } : {}}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Top summary row: gauge + summary stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Donut chart card */}
        <div className="md:col-span-1 bg-white rounded-xl border border-[#e2e8e5] flex flex-col items-center justify-center py-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7c75] mb-4">Squad Accuracy</p>
          {(() => {
            const size = 100;
            const stroke = 12;
            const r = (size - stroke) / 2;
            const circ = 2 * Math.PI * r;
            const filled = (squadOverallPct / 100) * circ;
            const color = squadOverallPct >= 85 ? "#007239" : squadOverallPct >= 70 ? "#f97316" : "#ef3b24";
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8e5" strokeWidth={stroke} />
                <circle
                  cx={size/2} cy={size/2} r={r}
                  fill="none" stroke={color} strokeWidth={stroke}
                  strokeDasharray={`${filled} ${circ}`}
                  strokeDashoffset={circ / 4}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${size/2} ${size/2})`}
                />
                <text x={size/2} y={size/2 + 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="#002e23">{squadOverallPct}%</text>
              </svg>
            );
          })()}
        </div>

        {/* Summary stat cards */}
        <div className="md:col-span-3 grid grid-cols-3 gap-4">
          <StatBox label="Active Referees" value={refStats.length} />
          <StatBox label="Total Decisions" value={totalDecisions} />
          <StatBox
            label="Correct Decisions"
            value={totalCorrect}
            sub={`${totalDecisions - totalCorrect} incorrect`}
            accent="#007239"
          />
          {(() => {
            const critTotal = refStats.reduce((a, s) => a + s.critical_total, 0);
            const critCorrect = refStats.reduce((a, s) => a + s.critical_correct, 0);
            const critPct = critTotal > 0 ? Math.round((critCorrect / critTotal) * 100) : 0;
            const genTotal = refStats.reduce((a, s) => a + s.general_total, 0);
            const genCorrect = refStats.reduce((a, s) => a + s.general_correct, 0);
            const genPct = genTotal > 0 ? Math.round((genCorrect / genTotal) * 100) : 0;
            return (
              <>
                <StatBox
                  label="Critical DM Accuracy"
                  value={`${critPct}%`}
                  sub={`${critCorrect}/${critTotal} decisions`}
                  accent={critPct >= 85 ? "#007239" : critPct >= 70 ? "#f97316" : "#ef3b24"}
                />
                <StatBox
                  label="General DM Accuracy"
                  value={`${genPct}%`}
                  sub={`${genCorrect}/${genTotal} decisions`}
                  accent={genPct >= 85 ? "#007239" : genPct >= 70 ? "#f97316" : "#ef3b24"}
                />
                <StatBox label="Games Analysed" value={gameIds.length} />
              </>
            );
          })()}
        </div>
      </div>

      {/* Charts row */}
      {refStats.length > 0 && (
        <SquadCharts
          refereeData={refereeChartData}
          callBreakdown={callBreakdown}
          eventParam={eventId}
        />
      )}

      {/* ── Accuracy by Referee Position ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 mb-6">
        <h2 className="font-semibold text-[#002e23] mb-4">Accuracy by Referee Position</h2>
        <PositionAccuracyChart data={positionData} />
      </div>

      {/* ── Squad Field Heat Map ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#e2e8e5] flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-[#002e23]">Decision Map by Field Zone</h2>
          <div className="flex gap-2">
            <Link href={filterUrl({ heatmap: "missed" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hmMode === "missed" ? "text-white border-transparent" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#f97316]"}`} style={hmMode === "missed" ? { backgroundColor: "#f97316" } : {}}>Missed DMs</Link>
            <Link href={filterUrl({ heatmap: "incorrect" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hmMode === "incorrect" ? "text-white border-transparent" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#ef3b24]"}`} style={hmMode === "incorrect" ? { backgroundColor: "#ef3b24" } : {}}>Incorrect Calls</Link>
            <Link href={filterUrl({ heatmap: "all" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hmMode === "all" ? "text-white border-transparent" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#2563eb]"}`} style={hmMode === "all" ? { backgroundColor: "#2563eb" } : {}}>All Calls</Link>
          </div>
        </div>
        <div className="px-6 py-5">
          <FieldHeatmap zoneCounts={zoneCounts} zoneTotals={zoneTotals} maxCount={maxZoneCount} mode={hmMode} />
        </div>
      </div>

      {/* Leaderboard table */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-[#e2e8e5] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#002e23]">Referee Leaderboard</h2>
            <p className="text-xs text-[#6b7c75] mt-0.5">Ranked by overall decision accuracy</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
              <th className="text-center px-4 py-3 w-12">#</th>
              <th className="text-left px-4 py-3">Referee</th>
              <th className="text-right px-4 py-3">Decisions</th>
              <th className="text-right px-4 py-3">Correct</th>
              <th className="text-right px-4 py-3">General %</th>
              <th className="text-right px-4 py-3">Critical %</th>
              <th className="px-4 py-3 w-40">Overall</th>
            </tr>
          </thead>
          <tbody>
            {refStats.map((s, i) => {
              const pct = Math.round((s.correct / s.total) * 100);
              const genPct = s.general_total > 0 ? Math.round((s.general_correct / s.general_total) * 100) : null;
              const critPct = s.critical_total > 0 ? Math.round((s.critical_correct / s.critical_total) * 100) : null;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              return (
                <tr key={s.id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                  <td className="px-4 py-4 text-center text-[#6b7c75] font-medium">
                    {medal ?? <span className="text-xs">{i + 1}</span>}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/dashboard/referee/${s.id}${eventId ? `?event=${eventId}` : ""}`}
                      className="font-medium text-[#002e23] hover:text-[#007239]"
                    >
                      {s.full_name}
                    </Link>
                    {s.squad && <span className="ml-2 text-xs text-[#6b7c75]">{s.squad}</span>}
                  </td>
                  <td className="px-4 py-4 text-right text-[#6b7c75]">{s.total}</td>
                  <td className="px-4 py-4 text-right text-[#6b7c75]">{s.correct}</td>
                  <td className="px-4 py-4 text-right font-medium" style={{ color: genPct != null ? pctColor(genPct) : "#6b7c75" }}>
                    {genPct != null ? `${genPct}%` : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-medium" style={{ color: critPct != null ? pctColor(critPct) : "#6b7c75" }}>
                    {critPct != null ? `${critPct}%` : "—"}
                  </td>
                  <td className="px-4 py-4">
                    <AccuracyBar correct={s.correct} total={s.total} />
                  </td>
                </tr>
              );
            })}
            {refStats.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#6b7c75] text-sm">
                  No data for this event yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Games in scope */}
      {games && games.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#e2e8e5]">
            <h2 className="font-semibold text-[#002e23]">Games Analysed</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                <th className="text-left px-6 py-3">Game</th>
                <th className="text-left px-6 py-3">Event</th>
                <th className="text-left px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/game/${g.id}`} className="font-medium text-[#002e23] hover:text-[#007239]">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-[#6b7c75]">
                    {(g.events as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-[#6b7c75]">
                    {g.game_date ? new Date(g.game_date).toLocaleDateString("en-AU") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FieldHeatmap({ zoneCounts, zoneTotals, maxCount, mode }: { zoneCounts: Record<string, number>; zoneTotals: Record<string, number>; maxCount: number; mode: string }) {
  const W = 640, H = 280;
  const fx = 20, fy = 20, fw = 600, fh = 240;
  const mToPx = fw / 70;
  const z1x = fx + 25 * mToPx;
  const z2x = fx + 45 * mToPx;
  const tryL  = fx + 7 * mToPx;
  const half  = fx + 35 * mToPx;
  const tryR  = fx + 63 * mToPx;

  const heatFill = (zone: string) => {
    const count = zoneCounts[zone] ?? 0;
    if (count === 0) return "rgba(0,0,0,0)";
    const opacity = 0.18 + (count / maxCount) * 0.62;
    if (mode === "all") return `rgba(37,99,235,${opacity.toFixed(2)})`;
    return mode === "incorrect"
      ? `rgba(239,59,36,${opacity.toFixed(2)})`
      : `rgba(249,115,22,${opacity.toFixed(2)})`;
  };

  const labelColor = (zone: string) => (zoneCounts[zone] ?? 0) > 0 ? "white" : "rgba(255,255,255,0.5)";

  const grandTotal = Object.values(zoneTotals).reduce((a, b) => a + b, 0);
  const zoneSub = (zone: string) => {
    const count = zoneCounts[zone] ?? 0;
    if (mode === "all") {
      const pct = grandTotal > 0 ? Math.round((count / grandTotal) * 100) : 0;
      return `calls · ${pct}% of total`;
    }
    const zoneTotal = zoneTotals[zone] ?? 0;
    const pct = zoneTotal > 0 ? Math.round((count / zoneTotal) * 100) : 0;
    return `${mode === "incorrect" ? "incorrect" : "missed"} · ${pct}% of calls here`;
  };

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }}>
      <rect x={fx} y={fy} width={fw} height={fh} fill="#1e6b2e" rx="3" />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={fx + i * (fw / 7)} y={fy} width={fw / 7} height={fh} fill={i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} />
      ))}
      <rect x={fx} y={fy} width={z1x - fx} height={fh} fill={heatFill("Attacking 3rd")} />
      <rect x={z1x} y={fy} width={z2x - z1x} height={fh} fill={heatFill("Middle 3rd")} />
      <rect x={z2x} y={fy} width={fw - (z2x - fx)} height={fh} fill={heatFill("Defensive 3rd")} />
      <rect x={fx} y={fy} width={tryL - fx} height={fh} fill="rgba(255,255,255,0.06)" />
      <rect x={tryR} y={fy} width={fw - (tryR - fx)} height={fh} fill="rgba(255,255,255,0.06)" />
      <line x1={tryL} y1={fy} x2={tryL} y2={fy + fh} stroke="white" strokeWidth="2" />
      <line x1={tryR} y1={fy} x2={tryR} y2={fy + fh} stroke="white" strokeWidth="2" />
      <line x1={z1x} y1={fy} x2={z1x} y2={fy + fh} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="8 5" />
      <line x1={z2x} y1={fy} x2={z2x} y2={fy + fh} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="8 5" />
      <line x1={half} y1={fy} x2={half} y2={fy + fh} stroke="white" strokeWidth="2.5" />
      <circle cx={half} cy={fy + fh / 2} r="4" fill="none" stroke="white" strokeWidth="1.5" />
      <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke="white" strokeWidth="2.5" rx="3" />
      {[
        { zone: "Attacking 3rd", cx: (fx + z1x) / 2 },
        { zone: "Middle 3rd",    cx: (z1x + z2x) / 2 },
        { zone: "Defensive 3rd", cx: (z2x + fx + fw) / 2 },
      ].map(({ zone, cx }) => {
        const count = zoneCounts[zone] ?? 0;
        return (
          <g key={zone}>
            <text x={cx} y={fy + fh / 2 - 18} textAnchor="middle" fontSize="10" fontWeight="600" fill="rgba(255,255,255,0.75)">{zone}</text>
            <text x={cx} y={fy + fh / 2 + 16} textAnchor="middle" fontSize="36" fontWeight="800" fill={labelColor(zone)}>{count}</text>
            <text x={cx} y={fy + fh / 2 + 34} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.6)">{zoneSub(zone)}</text>
          </g>
        );
      })}
      <text x={fx + (tryL - fx) / 2} y={fy + fh / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" transform={`rotate(-90, ${fx + (tryL - fx) / 2}, ${fy + fh / 2})`}>IN-GOAL</text>
      <text x={tryR + (fx + fw - tryR) / 2} y={fy + fh / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" transform={`rotate(-90, ${tryR + (fx + fw - tryR) / 2}, ${fy + fh / 2})`}>IN-GOAL</text>
      <text x={half} y={fy - 6} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontWeight="600">HALFWAY</text>
    </svg>
  );
}

function pctColor(pct: number) {
  if (pct >= 85) return "#007239";
  if (pct >= 70) return "#f97316";
  return "#ef3b24";
}

function StatBox({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8e5] px-5 py-4 flex flex-col justify-between">
      <p className="text-xs font-medium uppercase tracking-widest text-[#6b7c75]">{label}</p>
      <p className="text-2xl font-bold mt-2" style={{ color: accent ?? "#002e23" }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#6b7c75] mt-0.5">{sub}</p>}
    </div>
  );
}

