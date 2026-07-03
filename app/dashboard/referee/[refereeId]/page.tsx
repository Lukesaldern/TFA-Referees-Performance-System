import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import AccuracyBar from "@/components/AccuracyBar";
import StatCard from "@/components/StatCard";
import PositionAccuracyChart from "@/components/PositionAccuracyChart";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RefereeDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ refereeId: string }>;
  searchParams: Promise<{ event?: string; field?: string; severity?: string; heatmap?: string; trendcall?: string }>;
}) {
  const { refereeId } = await params;
  const { event: eventId, field: fieldFilter, severity: severityFilter, heatmap: heatmapMode, trendcall: trendCall } = await searchParams;
  const supabase = await createClient();

  const { data: events } = await supabase.from("events").select("id, name, starts_on").order("starts_on", { ascending: false });
  const { data: referee } = await supabase.from("referees").select("id, full_name, squad, accreditation, email").eq("id", refereeId).single();
  if (!referee) notFound();

  const filterUrl = (overrides: Record<string, string | undefined>) => {
    const p: Record<string, string> = {};
    if (eventId) p.event = eventId;
    if (fieldFilter) p.field = fieldFilter;
    if (severityFilter) p.severity = severityFilter;
    if (heatmapMode) p.heatmap = heatmapMode;
    if (trendCall) p.trendcall = trendCall;
    Object.entries(overrides).forEach(([k, v]) => { if (v === undefined) delete p[k]; else p[k] = v; });
    const qs = new URLSearchParams(p).toString();
    return `/dashboard/referee/${refereeId}${qs ? `?${qs}` : ""}`;
  };

  // ── Main filtered rows (stats, call breakdown, decision log) ──────────────
  let rowsQuery = supabase
    .from("decision_accuracy")
    .select("decision_id, game_id, accuracy, importance, call_text, is_missed, start_sec, game_date, event_id, field_position")
    .eq("referee_id", refereeId)
    .order("game_date", { ascending: false });
  if (eventId) rowsQuery = rowsQuery.eq("event_id", eventId);
  if (fieldFilter) rowsQuery = rowsQuery.eq("field_position", fieldFilter);
  if (severityFilter === "critical") rowsQuery = rowsQuery.eq("importance", "CRITICAL");
  if (severityFilter === "general") rowsQuery = rowsQuery.eq("importance", "GENERAL");
  const { data: rows } = await rowsQuery;

  // ── Trend rows (no field/severity filter, optional call type filter) ───────
  let trendQuery = supabase
    .from("decision_accuracy")
    .select("game_id, event_id, accuracy, call_text")
    .eq("referee_id", refereeId);
  if (eventId) trendQuery = trendQuery.eq("event_id", eventId);
  if (trendCall) trendQuery = trendQuery.eq("call_text", trendCall);
  const { data: trendRows } = await trendQuery;

  // Per-event trend: referee accuracy, ordered chronologically by event start date
  const eventOrder = [...(events ?? [])].sort((a, b) => (a.starts_on ?? "").localeCompare(b.starts_on ?? ""));
  const trendEventAcc: Record<string, { total: number; correct: number }> = {};
  for (const row of trendRows ?? []) {
    if (!row.event_id) continue;
    if (!trendEventAcc[row.event_id]) trendEventAcc[row.event_id] = { total: 0, correct: 0 };
    trendEventAcc[row.event_id].total++;
    if (row.accuracy === "Correct") trendEventAcc[row.event_id].correct++;
  }
  const trendData = eventOrder
    .filter(e => trendEventAcc[e.id])
    .map(e => {
      const s = trendEventAcc[e.id];
      return { event_id: e.id, label: e.name, pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0 };
    });

  // Squad average for the same events (all referees)
  const trendEventIds = trendData.map(e => e.event_id);
  let squadTrendMap: Record<string, number> = {};
  if (trendEventIds.length > 0) {
    let sqQuery = supabase.from("decision_accuracy").select("event_id, accuracy").in("event_id", trendEventIds);
    if (trendCall) sqQuery = sqQuery.eq("call_text", trendCall);
    const { data: sqRows } = await sqQuery;
    const sqAcc: Record<string, { t: number; c: number }> = {};
    for (const r of sqRows ?? []) {
      if (!r.event_id) continue;
      if (!sqAcc[r.event_id]) sqAcc[r.event_id] = { t: 0, c: 0 };
      sqAcc[r.event_id].t++;
      if (r.accuracy === "Correct") sqAcc[r.event_id].c++;
    }
    squadTrendMap = Object.fromEntries(Object.entries(sqAcc).map(([eid, s]) => [eid, s.t > 0 ? Math.round((s.c / s.t) * 100) : 0]));
  }

  // All call types for trend filter pills
  const allCallTypes = [...new Set((trendRows ?? []).map(r => r.call_text).filter(Boolean))].sort() as string[];

  // ── Heatmap rows (no field filter, respects severity) ────────────────────
  let hmQuery = supabase
    .from("decision_accuracy")
    .select("field_position, accuracy, is_missed")
    .eq("referee_id", refereeId);
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

  // ── Games map ─────────────────────────────────────────────────────────────
  const allGameIds = [...new Set((rows ?? []).map(r => r.game_id).filter(Boolean))];
  const { data: games } = allGameIds.length > 0
    ? await supabase.from("games").select("id, name, game_date, hudl_link").in("id", allGameIds)
    : { data: [] };
  const gameMap = Object.fromEntries((games ?? []).map(g => [g.id, g]));

  // Consequence labels (e.g. "Forced Sub") keyed by decision_id
  const decisionIds = [...new Set((rows ?? []).map(r => r.decision_id).filter(Boolean))];
  const { data: consequenceRows } = decisionIds.length > 0
    ? await supabase
        .from("decision_labels")
        .select("decision_id, text")
        .eq("group_normalised", "CONSEQUENCE")
        .in("decision_id", decisionIds)
    : { data: [] };
  const consequenceMap = Object.fromEntries((consequenceRows ?? []).map(c => [c.decision_id, c.text]));

  // Referee position labels keyed by decision_id, for the position accuracy chart
  const { data: positionRows } = decisionIds.length > 0
    ? await supabase
        .from("decision_labels")
        .select("decision_id, text")
        .eq("group_normalised", "REFEREE_POSITION")
        .in("decision_id", decisionIds)
    : { data: [] };
  // A decision can carry multiple positions — count it under each one
  const positionsByDecision: Record<string, string[]> = {};
  for (const p of positionRows ?? []) {
    (positionsByDecision[p.decision_id] ??= []).push(p.text);
  }
  const positionData = (rows ?? []).flatMap(r =>
    (positionsByDecision[r.decision_id] ?? []).map(position => ({
      call: r.call_text, position, correct: r.accuracy === "Correct",
    }))
  );

  // ── Stats (from filtered rows) ────────────────────────────────────────────
  const total = rows?.length ?? 0;
  const correct = rows?.filter(r => r.accuracy === "Correct").length ?? 0;
  const criticalRows = rows?.filter(r => r.importance === "CRITICAL") ?? [];
  const criticalCorrect = criticalRows.filter(r => r.accuracy === "Correct").length;
  const generalRows = rows?.filter(r => r.importance !== "CRITICAL") ?? [];
  const generalCorrect = generalRows.filter(r => r.accuracy === "Correct").length;
  const missed = rows?.filter(r => r.is_missed).length ?? 0;

  // Per-game stats
  const gameStatsMap: Record<string, { game_id: string; total: number; correct: number }> = {};
  for (const row of rows ?? []) {
    if (!row.game_id) continue;
    if (!gameStatsMap[row.game_id]) gameStatsMap[row.game_id] = { game_id: row.game_id, total: 0, correct: 0 };
    gameStatsMap[row.game_id].total++;
    if (row.accuracy === "Correct") gameStatsMap[row.game_id].correct++;
  }
  const gameStats = Object.values(gameStatsMap);

  // Call type breakdown
  const callMap: Record<string, { total: number; correct: number }> = {};
  for (const row of rows ?? []) {
    if (!row.call_text) continue;
    if (!callMap[row.call_text]) callMap[row.call_text] = { total: 0, correct: 0 };
    callMap[row.call_text].total++;
    if (row.accuracy === "Correct") callMap[row.call_text].correct++;
  }
  const callStats = Object.entries(callMap).sort((a, b) => b[1].total - a[1].total);

  const FIELD_ZONES = ["Attacking 3rd", "Middle 3rd", "Defensive 3rd"];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-2">
        <Link href="/dashboard/referee" className="text-sm text-[#007239] hover:underline">← Referees</Link>
      </div>

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#002e23]">{referee.full_name}</h1>
        <div className="flex gap-3 mt-1">
          {referee.squad && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#002e23] text-[#ffe600]">{referee.squad}</span>}
          {referee.accreditation && <span className="text-xs text-[#6b7c75]">{referee.accreditation}</span>}
        </div>
      </div>

      {/* Event filter */}
      <div className="flex gap-2 flex-wrap mb-3">
        <Link href={filterUrl({ event: undefined })} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${!eventId ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#007239] hover:text-[#007239]"}`} style={!eventId ? { backgroundColor: "#ffe600" } : {}}>All Time</Link>
        {(events ?? []).map(e => (
          <Link key={e.id} href={filterUrl({ event: e.id })} className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${eventId === e.id ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#007239] hover:text-[#007239]"}`} style={eventId === e.id ? { backgroundColor: "#ffe600" } : {}}>{e.name}</Link>
        ))}
      </div>

      {/* Field zone filter */}
      <div className="flex gap-2 flex-wrap mb-3">
        <Link href={filterUrl({ field: undefined })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!fieldFilter ? "border-transparent text-white" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#002e23] hover:text-[#002e23]"}`} style={!fieldFilter ? { backgroundColor: "#002e23" } : {}}>All Zones</Link>
        {FIELD_ZONES.map(z => (
          <Link key={z} href={filterUrl({ field: z })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${fieldFilter === z ? "border-transparent text-white" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#002e23] hover:text-[#002e23]"}`} style={fieldFilter === z ? { backgroundColor: "#002e23" } : {}}>{z}</Link>
        ))}
      </div>

      {/* Severity filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        <Link href={filterUrl({ severity: undefined })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!severityFilter ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5]"}`} style={!severityFilter ? { backgroundColor: "#ffe600" } : {}}>All Severity</Link>
        <Link href={filterUrl({ severity: "critical" })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${severityFilter === "critical" ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5]"}`} style={severityFilter === "critical" ? { backgroundColor: "#ffe600" } : {}}>Critical DMs</Link>
        <Link href={filterUrl({ severity: "general" })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${severityFilter === "general" ? "border-transparent text-[#002e23]" : "text-[#6b7c75] border-[#e2e8e5]"}`} style={severityFilter === "general" ? { backgroundColor: "#ffe600" } : {}}>General DMs</Link>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Decisions" value={total} />
        <StatCard label="Overall Accuracy" value={total > 0 ? `${Math.round((correct / total) * 100)}%` : "—"} accent={total > 0 ? (correct / total >= 0.85 ? "#007239" : correct / total >= 0.7 ? "#f97316" : "#ef3b24") : "#6b7c75"} />
        <StatCard label="Critical Accuracy" value={criticalRows.length > 0 ? `${Math.round((criticalCorrect / criticalRows.length) * 100)}%` : "—"} sub={`${criticalRows.length} critical decisions`} accent={criticalRows.length > 0 ? (criticalCorrect / criticalRows.length >= 0.85 ? "#007239" : "#f97316") : "#6b7c75"} />
        <StatCard label="Missed DMs" value={missed} accent={missed > 0 ? "#f97316" : "#007239"} />
      </div>

      {/* ── Trend Chart ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
        <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5]">
          <h2 className="font-semibold text-[#002e23] mb-3">Accuracy Trend vs Squad</h2>
          {/* Call type filter pills */}
          <div className="flex gap-2 flex-wrap">
            <Link href={filterUrl({ trendcall: undefined })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!trendCall ? "border-transparent text-white" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#002e23]"}`} style={!trendCall ? { backgroundColor: "#002e23" } : {}}>Overall</Link>
            {allCallTypes.map(ct => (
              <Link key={ct} href={filterUrl({ trendcall: ct })} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${trendCall === ct ? "border-transparent text-white" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#002e23]"}`} style={trendCall === ct ? { backgroundColor: "#002e23" } : {}}>{ct}</Link>
            ))}
          </div>
        </div>
        <div className="px-4 md:px-6 py-4">
          <TrendChart data={trendData} squadAvg={squadTrendMap} />
        </div>
      </div>

      {/* ── Field Heat Map ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
        <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5] flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-[#002e23]">Decision Map by Field Zone</h2>
          <div className="flex gap-2">
            <Link href={filterUrl({ heatmap: "missed" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hmMode === "missed" ? "text-white border-transparent" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#f97316]"}`} style={hmMode === "missed" ? { backgroundColor: "#f97316" } : {}}>Missed DMs</Link>
            <Link href={filterUrl({ heatmap: "incorrect" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hmMode === "incorrect" ? "text-white border-transparent" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#ef3b24]"}`} style={hmMode === "incorrect" ? { backgroundColor: "#ef3b24" } : {}}>Incorrect Calls</Link>
            <Link href={filterUrl({ heatmap: "all" })} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${hmMode === "all" ? "text-white border-transparent" : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#2563eb]"}`} style={hmMode === "all" ? { backgroundColor: "#2563eb" } : {}}>All Calls</Link>
          </div>
        </div>
        <div className="px-4 md:px-6 py-5">
          <FieldHeatmap zoneCounts={zoneCounts} zoneTotals={zoneTotals} maxCount={maxZoneCount} mode={hmMode} />
        </div>
      </div>

      {/* ── Accuracy by Referee Position ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 mb-6">
        <h2 className="font-semibold text-[#002e23] mb-4">Accuracy by Referee Position</h2>
        <PositionAccuracyChart data={positionData} />
      </div>

      {/* Accuracy breakdown */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 mb-6">
        <h2 className="font-semibold text-[#002e23] mb-4">Accuracy Breakdown</h2>
        <div className="space-y-4">
          <div><p className="text-xs text-[#6b7c75] mb-1">Overall</p><AccuracyBar correct={correct} total={total} /></div>
          <div><p className="text-xs text-[#6b7c75] mb-1">General DMs</p><AccuracyBar correct={generalCorrect} total={generalRows.length} /></div>
          <div><p className="text-xs text-[#6b7c75] mb-1">Critical DMs</p><AccuracyBar correct={criticalCorrect} total={criticalRows.length} /></div>
        </div>
      </div>

      {/* Per-game performance */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
        <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5]">
          <h2 className="font-semibold text-[#002e23]">Performance by Game</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                <th className="text-left px-4 md:px-6 py-3">Game</th>
                <th className="text-left px-4 md:px-6 py-3 hidden sm:table-cell">Date</th>
                <th className="text-right px-4 md:px-6 py-3">Dec.</th>
                <th className="px-4 md:px-6 py-3 w-32 md:w-48">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {gameStats.map(gs => {
                const g = gameMap[gs.game_id];
                return (
                  <tr key={gs.game_id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                    <td className="px-4 md:px-6 py-3"><Link href={`/dashboard/game/${gs.game_id}`} className="font-medium text-[#002e23] hover:text-[#007239]">{g?.name ?? gs.game_id}</Link></td>
                    <td className="px-4 md:px-6 py-3 text-[#6b7c75] hidden sm:table-cell">{g?.game_date ? new Date(g.game_date).toLocaleDateString("en-AU") : "—"}</td>
                    <td className="px-4 md:px-6 py-3 text-right text-[#6b7c75]">{gs.total}</td>
                    <td className="px-4 md:px-6 py-3"><AccuracyBar correct={gs.correct} total={gs.total} /></td>
                  </tr>
                );
              })}
              {gameStats.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-[#6b7c75]">No games yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accuracy by call type */}
      {callStats.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
          <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5]">
            <h2 className="font-semibold text-[#002e23]">Accuracy by Call Type</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead>
                <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                  <th className="text-left px-4 md:px-6 py-3">Call</th>
                  <th className="text-right px-4 md:px-6 py-3">Count</th>
                  <th className="px-4 md:px-6 py-3 w-32 md:w-48">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {callStats.map(([key, s]) => (
                  <tr key={key} className="border-b border-[#e2e8e5] last:border-0">
                    <td className="px-4 md:px-6 py-3 font-medium text-[#002e23]">{key}</td>
                    <td className="px-4 md:px-6 py-3 text-right text-[#6b7c75]">{s.total}</td>
                    <td className="px-4 md:px-6 py-3"><AccuracyBar correct={s.correct} total={s.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision log */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5]">
          <h2 className="font-semibold text-[#002e23]">Decision Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                <th className="text-left px-4 md:px-6 py-3">Game</th>
                <th className="text-left px-4 md:px-6 py-3 hidden sm:table-cell">Time</th>
                <th className="text-left px-4 md:px-6 py-3 hidden md:table-cell">Importance</th>
                <th className="text-left px-4 md:px-6 py-3">Call</th>
                <th className="text-left px-4 md:px-6 py-3">Result</th>
                <th className="px-4 md:px-6 py-3 hidden sm:table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-[#6b7c75]">No decisions match the selected filters.</td></tr>}
              {(rows ?? []).map(row => {
                const g = gameMap[row.game_id ?? ""];
                const mins = Math.floor((row.start_sec ?? 0) / 60);
                const secs = Math.floor((row.start_sec ?? 0) % 60);
                const isCorrect = row.accuracy === "Correct";
                return (
                  <tr key={row.decision_id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                    <td className="px-4 md:px-6 py-3"><Link href={`/dashboard/game/${row.game_id}`} className="text-[#007239] hover:underline text-xs">{g?.name ?? "—"}</Link></td>
                    <td className="px-4 md:px-6 py-3 text-[#6b7c75] font-mono text-xs hidden sm:table-cell">{mins}:{String(secs).padStart(2, "0")}</td>
                    <td className="px-4 md:px-6 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.importance === "CRITICAL" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{row.importance}</span>
                    </td>
                    <td className="px-4 md:px-6 py-3 text-[#002e23] text-xs">
                      {row.is_missed && <span className="text-orange-600 font-medium mr-1">MISSED</span>}
                      {row.call_text ?? <span className="text-[#6b7c75]">—</span>}
                      {consequenceMap[row.decision_id] && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800 whitespace-nowrap">
                          {consequenceMap[row.decision_id]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3">
                      <span className={`text-xs font-semibold ${isCorrect ? "text-[#007239]" : "text-[#ef3b24]"}`}>{row.accuracy ?? "—"}</span>
                    </td>
                    <td className="px-4 md:px-6 py-3 hidden sm:table-cell">
                      {g?.hudl_link && <a href={g.hudl_link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#007239] hover:underline">Hudl ↗</a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Trend Chart ──────────────────────────────────────────────────────────────
function TrendChart({
  data,
  squadAvg,
}: {
  data: Array<{ event_id: string; label: string; pct: number }>;
  squadAvg: Record<string, number>;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-[#6b7c75] py-6 text-center">No event data to display.</p>;
  }

  const W = 520, H = 160;
  const padL = 38, padR = 16, padT = 20, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xPos = (i: number) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yPos = (pct: number) => padT + plotH - (Math.min(100, Math.max(0, pct)) / 100) * plotH;

  const refPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(d.pct).toFixed(1)}`).join(" ");
  const sqPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(squadAvg[d.event_id] ?? 0).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(g => (
          <g key={g}>
            <line x1={padL} y1={yPos(g)} x2={W - padR} y2={yPos(g)} stroke="#e2e8e5" strokeWidth="1" />
            <text x={padL - 6} y={yPos(g) + 4} textAnchor="end" fontSize="9" fill="#6b7c75">{g}%</text>
          </g>
        ))}

        {/* Squad avg line (dashed grey) */}
        {data.length > 1 && <path d={sqPath} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5 3" />}
        {data.map((d, i) => (
          <g key={`sq-${d.event_id}`}>
            <circle cx={xPos(i)} cy={yPos(squadAvg[d.event_id] ?? 0)} r="3" fill="#9ca3af" />
            <text x={xPos(i)} y={yPos(squadAvg[d.event_id] ?? 0) + 14} textAnchor="middle" fontSize="8" fill="#9ca3af">{squadAvg[d.event_id] ?? 0}%</text>
          </g>
        ))}

        {/* Referee line (solid green) */}
        {data.length > 1 && <path d={refPath} fill="none" stroke="#007239" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {data.map((d, i) => (
          <g key={`ref-${d.event_id}`}>
            <circle cx={xPos(i)} cy={yPos(d.pct)} r="5" fill="#007239" />
            <text x={xPos(i)} y={yPos(d.pct) - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="#002e23">{d.pct}%</text>
            <text x={xPos(i)} y={H - padB + 14} textAnchor="middle" fontSize="8" fill="#6b7c75">{d.label}</text>
          </g>
        ))}

        {/* Legend */}
        <circle cx={padL} cy={H - 4} r="4" fill="#007239" />
        <text x={padL + 8} y={H} fontSize="9" fill="#002e23">This referee</text>
        <circle cx={padL + 90} cy={H - 4} r="3" fill="#9ca3af" />
        <text x={padL + 100} y={H} fontSize="9" fill="#6b7c75">Squad avg</text>
      </svg>
    </div>
  );
}

// ── Field Heat Map ───────────────────────────────────────────────────────────
function FieldHeatmap({ zoneCounts, zoneTotals, maxCount, mode }: { zoneCounts: Record<string, number>; zoneTotals: Record<string, number>; maxCount: number; mode: string }) {
  // Landscape touch football field — 70m long, 50m wide
  // Zones: Attacking 3rd (0–25m), Middle 3rd (25–45m), Defensive 3rd (45–70m)
  const W = 640, H = 280;
  const fx = 20, fy = 20, fw = 600, fh = 240;

  const mToPx = fw / 70;
  // Zone x boundaries
  const z1x = fx + 25 * mToPx;  // end of Attacking 3rd (25m)
  const z2x = fx + 45 * mToPx;  // end of Middle 3rd (45m)
  // Key markings
  const tryL  = fx + 7 * mToPx;  // left try line (7m)
  const half  = fx + 35 * mToPx; // halfway (35m)
  const tenL  = fx + 25 * mToPx; // left 10m line (aligns with z1)
  const tenR  = fx + 45 * mToPx; // right 10m line (aligns with z2)
  const tryR  = fx + 63 * mToPx; // right try line (63m)

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
      {/* Grass base */}
      <rect x={fx} y={fy} width={fw} height={fh} fill="#1e6b2e" rx="3" />

      {/* Alternating grass stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x={fx + i * (fw / 7)} y={fy} width={fw / 7} height={fh}
          fill={i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} />
      ))}

      {/* Zone heat overlays */}
      <rect x={fx} y={fy} width={z1x - fx} height={fh} fill={heatFill("Attacking 3rd")} />
      <rect x={z1x} y={fy} width={z2x - z1x} height={fh} fill={heatFill("Middle 3rd")} />
      <rect x={z2x} y={fy} width={fw - (z2x - fx)} height={fh} fill={heatFill("Defensive 3rd")} />

      {/* In-goal shading */}
      <rect x={fx} y={fy} width={tryL - fx} height={fh} fill="rgba(255,255,255,0.06)" />
      <rect x={tryR} y={fy} width={fw - (tryR - fx)} height={fh} fill="rgba(255,255,255,0.06)" />

      {/* Try lines */}
      <line x1={tryL} y1={fy} x2={tryL} y2={fy + fh} stroke="white" strokeWidth="2" />
      <line x1={tryR} y1={fy} x2={tryR} y2={fy + fh} stroke="white" strokeWidth="2" />

      {/* 10m / zone boundary lines (dashed) */}
      <line x1={tenL} y1={fy} x2={tenL} y2={fy + fh} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="8 5" />
      <line x1={tenR} y1={fy} x2={tenR} y2={fy + fh} stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="8 5" />

      {/* Halfway line */}
      <line x1={half} y1={fy} x2={half} y2={fy + fh} stroke="white" strokeWidth="2.5" />

      {/* Centre dot */}
      <circle cx={half} cy={fy + fh / 2} r="4" fill="none" stroke="white" strokeWidth="1.5" />

      {/* Field boundary */}
      <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke="white" strokeWidth="2.5" rx="3" />

      {/* Zone labels + counts */}
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
            <text x={cx} y={fy + fh / 2 + 34} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.6)">
              {zoneSub(zone)}
            </text>
          </g>
        );
      })}

      {/* End zone labels */}
      <text x={fx + (tryL - fx) / 2} y={fy + fh / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" transform={`rotate(-90, ${fx + (tryL - fx) / 2}, ${fy + fh / 2})`}>IN-GOAL</text>
      <text x={tryR + (fx + fw - tryR) / 2} y={fy + fh / 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)" transform={`rotate(-90, ${tryR + (fx + fw - tryR) / 2}, ${fy + fh / 2})`}>IN-GOAL</text>

      {/* Halfway label */}
      <text x={half} y={fy - 6} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.6)" fontWeight="600">HALFWAY</text>
    </svg>
  );
}
