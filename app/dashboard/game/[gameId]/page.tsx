import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import AccuracyBar from "@/components/AccuracyBar";
import StatCard from "@/components/StatCard";
import PositionAccuracyChart from "@/components/PositionAccuracyChart";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GameDashboardPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const supabase = await createClient();

  // Get current user's role and referee ID
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentReferee } = user
    ? await supabase.from("referees").select("id, role").eq("auth_user_id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = currentReferee?.role === "admin";
  const myRefereeId = currentReferee?.id ?? null;

  // Referees can only view games they were involved in
  if (!isAdmin) {
    const { data: myAssignment } = myRefereeId
      ? await supabase
          .from("referee_game_assignments")
          .select("game_id")
          .eq("game_id", gameId)
          .eq("referee_id", myRefereeId)
          .maybeSingle()
      : { data: null };
    if (!myAssignment) notFound();
  }

  const { data: game } = await supabase
    .from("games")
    .select("id, name, game_date, hudl_link, events(name)")
    .eq("id", gameId)
    .single();

  if (!game) notFound();

  // All decisions in this game
  const { data: allRows } = await supabase
    .from("decision_accuracy")
    .select("decision_id, referee_id, accuracy, importance, call_group, call_text, is_missed, start_sec, team_name, field_position")
    .eq("game_id", gameId)
    .order("start_sec");

  const { data: referees } = await supabase
    .from("referees")
    .select("id, full_name");

  // Consequence labels (e.g. "Forced Sub") keyed by decision_id
  const decisionIds = [...new Set((allRows ?? []).map((r) => r.decision_id).filter(Boolean))];
  const { data: consequenceRows } = decisionIds.length > 0
    ? await supabase
        .from("decision_labels")
        .select("decision_id, text")
        .eq("group_normalised", "CONSEQUENCE")
        .in("decision_id", decisionIds)
    : { data: [] };
  const consequenceMap = Object.fromEntries((consequenceRows ?? []).map((c) => [c.decision_id, c.text]));

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
  const positionData = (allRows ?? []).flatMap((r) =>
    (positionsByDecision[r.decision_id] ?? []).map((position) => ({
      call: r.call_text, position, correct: r.accuracy === "Correct",
    }))
  );

  const refMap = Object.fromEntries((referees ?? []).map((r) => [r.id, r.full_name]));

  // Aggregate stats use all rows (whole-game view for both admin and referee)
  const totalDecisions = allRows?.length ?? 0;
  const totalCorrect = allRows?.filter((r) => r.accuracy === "Correct").length ?? 0;
  const missedCount = allRows?.filter((r) => r.is_missed).length ?? 0;
  const penaltyCount = allRows?.filter((r) => r.accuracy === "Incorrect").length ?? 0;

  // Score: count unique TRY instances per team
  // decision_accuracy view includes team_name for TRY events
  const tryRows = (allRows ?? []).filter((r) => r.call_text === "TRY" && r.team_name);
  const scoreMap: Record<string, number> = {};
  const seenTryInstances = new Set<string>();
  for (const row of tryRows) {
    // Use start_sec as a proxy for unique instance (deduplicate per-referee duplicates)
    const key = `${row.team_name}-${row.start_sec}`;
    if (!seenTryInstances.has(key)) {
      seenTryInstances.add(key);
      scoreMap[row.team_name!] = (scoreMap[row.team_name!] ?? 0) + 1;
    }
  }
  const scoreEntries = Object.entries(scoreMap).sort((a, b) => b[1] - a[1]);

  // Call type breakdown uses all rows (game aggregate — safe for both roles)
  type CallStats = { total: number; correct: number };
  const callMap: Record<string, CallStats> = {};
  for (const row of allRows ?? []) {
    if (!row.call_text) continue;
    const key = row.call_group ? `${row.call_group}: ${row.call_text}` : row.call_text;
    if (!callMap[key]) callMap[key] = { total: 0, correct: 0 };
    callMap[key].total++;
    if (row.accuracy === "Correct") callMap[key].correct++;
  }
  const callStats = Object.entries(callMap).sort((a, b) => b[1].total - a[1].total);

  // Per-referee breakdown — admin only
  type RefStats = { id: string; name: string; total: number; correct: number; critical_total: number; critical_correct: number };
  const statsMap: Record<string, RefStats> = {};
  if (isAdmin) {
    for (const row of allRows ?? []) {
      if (!row.referee_id) continue;
      if (!statsMap[row.referee_id]) {
        statsMap[row.referee_id] = { id: row.referee_id, name: refMap[row.referee_id] ?? row.referee_id, total: 0, correct: 0, critical_total: 0, critical_correct: 0 };
      }
      const s = statsMap[row.referee_id];
      s.total++;
      if (row.accuracy === "Correct") s.correct++;
      if (row.importance === "CRITICAL") {
        s.critical_total++;
        if (row.accuracy === "Correct") s.critical_correct++;
      }
    }
  }
  const refStats = Object.values(statsMap);

  // Decision log: admin sees all, referee sees only their own
  const decisionRows = isAdmin
    ? (allRows ?? [])
    : (allRows ?? []).filter((r) => r.referee_id === myRefereeId);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-2">
        <Link href="/dashboard/squad" className="text-sm text-[#007239] hover:underline">← Squad</Link>
      </div>
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#002e23]">{game.name}</h1>
          <p className="text-sm text-[#6b7c75] mt-1">
            {(game.events as unknown as { name: string } | null)?.name}
            {game.game_date ? ` · ${new Date(game.game_date).toLocaleDateString("en-AU")}` : ""}
          </p>
        </div>
        {game.hudl_link && (
          <a href={game.hudl_link} target="_blank" rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white shadow-md"
            style={{ background: "linear-gradient(135deg, #002e23 0%, #007239 50%, #ffe600 100%)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75"/>
              <polygon points="10,8 17,12 10,16" fill="currentColor"/>
            </svg>
            Start Video Clip Review
          </a>
        )}
      </div>

      {/* Final Score */}
      {scoreEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-[#e2e8e5] p-4 md:p-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6b7c75] mb-3">Final Score</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {scoreEntries.map(([team, score], i) => (
              <div key={team} className="flex items-center gap-4">
                {i > 0 && <span className="text-2xl font-bold text-[#6b7c75]">vs</span>}
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#002e23]">{score}</p>
                  <p className="text-sm font-medium text-[#6b7c75] mt-0.5">{team}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game summary stats — whole game, visible to all */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {(() => {
          const pct = totalDecisions > 0 ? Math.round((totalCorrect / totalDecisions) * 100) : null;
          return (
            <StatCard
              label="Referee Team Accuracy"
              value={pct !== null ? `${pct}%` : "—"}
              sub={`${totalCorrect}/${totalDecisions} decisions`}
              accent={pct === null ? "#6b7c75" : pct >= 85 ? "#007239" : pct >= 70 ? "#f97316" : "#ef3b24"}
            />
          );
        })()}
        <StatCard label="Correct" value={totalCorrect} accent="#007239" />
        <StatCard label="Incorrect Calls" value={penaltyCount} accent="#ef3b24" />
        <StatCard label="Missed DMs" value={missedCount} accent="#f97316" />
      </div>

      {/* Per-referee breakdown — admin only */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden mb-6">
          <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5]">
            <h2 className="font-semibold text-[#002e23]">Referee Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                  <th className="text-left px-4 md:px-6 py-3">Referee</th>
                  <th className="text-right px-4 md:px-6 py-3">Dec.</th>
                  <th className="text-right px-4 md:px-6 py-3 hidden sm:table-cell">Critical</th>
                  <th className="px-4 md:px-6 py-3 w-32 md:w-48">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {refStats.sort((a, b) => (b.correct / b.total) - (a.correct / a.total)).map((s) => (
                  <tr key={s.id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                    <td className="px-4 md:px-6 py-3">
                      <Link href={`/dashboard/referee/${s.id}`} className="font-medium text-[#002e23] hover:text-[#007239]">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 md:px-6 py-3 text-right text-[#6b7c75]">{s.total}</td>
                    <td className="px-4 md:px-6 py-3 text-right text-[#6b7c75] hidden sm:table-cell">
                      {s.critical_total > 0 ? `${Math.round((s.critical_correct / s.critical_total) * 100)}%` : "—"}
                    </td>
                    <td className="px-4 md:px-6 py-3">
                      <AccuracyBar correct={s.correct} total={s.total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accuracy by call type — game aggregate, visible to all */}
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
                  <td className="px-4 md:px-6 py-3">
                    <AccuracyBar correct={s.correct} total={s.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Accuracy by Referee Position ── */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 mb-6">
        <h2 className="font-semibold text-[#002e23] mb-4">Accuracy by Referee Position</h2>
        <PositionAccuracyChart data={positionData} />
      </div>

      {/* Decision log — admin sees all, referee sees own only */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-[#e2e8e5]">
          <h2 className="font-semibold text-[#002e23]">
            {isAdmin ? "All Decisions" : "My Decisions"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                <th className="text-left px-4 md:px-6 py-3 hidden sm:table-cell">Time</th>
                {isAdmin && <th className="text-left px-4 md:px-6 py-3">Referee</th>}
                <th className="text-left px-4 md:px-6 py-3 hidden md:table-cell">Importance</th>
                <th className="text-left px-4 md:px-6 py-3">Call</th>
                <th className="text-left px-4 md:px-6 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {decisionRows.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-[#6b7c75] text-sm">No decisions recorded for this game.</td></tr>
              )}
              {decisionRows.map((row) => {
                const mins = Math.floor((row.start_sec ?? 0) / 60);
                const secs = Math.floor((row.start_sec ?? 0) % 60);
                const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;
                const isCorrect = row.accuracy === "Correct";
                const isMissed = row.is_missed;
                return (
                  <tr key={row.decision_id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                    <td className="px-4 md:px-6 py-3 text-[#6b7c75] font-mono text-xs hidden sm:table-cell">{timeStr}</td>
                    {isAdmin && (
                      <td className="px-4 md:px-6 py-3 font-medium text-[#002e23] text-xs">{refMap[row.referee_id ?? ""] ?? "—"}</td>
                    )}
                    <td className="px-4 md:px-6 py-3 hidden md:table-cell">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${row.importance === "CRITICAL" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                        {row.importance}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 text-[#002e23] text-xs">
                      {isMissed ? <span className="text-orange-600 font-medium">MISSED </span> : null}
                      {row.call_text ?? <span className="text-[#6b7c75]">—</span>}
                      {consequenceMap[row.decision_id] && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800 whitespace-nowrap">
                          {consequenceMap[row.decision_id]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3">
                      <span className={`text-xs font-semibold ${isCorrect ? "text-[#007239]" : "text-[#ef3b24]"}`}>
                        {row.accuracy ?? "—"}
                      </span>
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
