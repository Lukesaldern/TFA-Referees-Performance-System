import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RefereesPage() {
  const supabase = await createClient();

  const { data: referees } = await supabase
    .from("referees")
    .select("id, full_name, squad, accreditation, email")
    .neq("role", "admin")
    .order("full_name");

  // Quick accuracy summary per referee
  const { data: accuracy } = await supabase
    .from("decision_accuracy")
    .select("referee_id, accuracy");

  type Summary = { total: number; correct: number };
  const summaryMap: Record<string, Summary> = {};
  for (const row of accuracy ?? []) {
    if (!row.referee_id) continue;
    if (!summaryMap[row.referee_id]) summaryMap[row.referee_id] = { total: 0, correct: 0 };
    summaryMap[row.referee_id].total++;
    if (row.accuracy === "Correct") summaryMap[row.referee_id].correct++;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <h1 className="text-2xl font-bold text-[#002e23] mb-6">Referees</h1>

      {!referees || referees.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8e5] px-6 py-12 text-center text-[#6b7c75] text-sm">
          No referees in roster yet.
        </div>
      ) : (
        <div className="space-y-3">
          {referees.map((r) => {
            const s = summaryMap[r.id];
            const pct = s && s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
            const accentColor = pct === null ? "#6b7c75" : pct >= 85 ? "#007239" : pct >= 70 ? "#f97316" : "#ef3b24";
            return (
              <Link
                key={r.id}
                href={`/dashboard/referee/${r.id}`}
                className="flex items-center justify-between bg-white rounded-xl border border-[#e2e8e5] px-4 py-4 hover:bg-[#f8faf9] hover:border-[#007239] transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#002e23] truncate">{r.full_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {r.squad && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#002e23", color: "#ffe600" }}>
                        {r.squad}
                      </span>
                    )}
                    {r.accreditation && (
                      <span className="text-xs text-[#6b7c75]">{r.accreditation}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-[#6b7c75]">{s?.total ?? 0} dec.</p>
                    <p className="font-bold text-base" style={{ color: accentColor }}>
                      {pct !== null ? `${pct}%` : "—"}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#6b7c75]">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
