"use client";

import { useState } from "react";

// Handles both the friendly names and the tagging-panel IDs, so the chart
// works regardless of which form ends up in the XML text field
const POSITION_NAMES: Record<string, string> = {
  REF_POSITION_CONTROL: "Control Ref",
  REF_POSITION_SIDELINE_CLOSE: "Sideline Close",
  REF_POSITION_SIDELINE_FAR: "Sideline Far",
};
const POSITION_ORDER = ["Control Ref", "Sideline Close", "Sideline Far"];

export interface PositionRow {
  call: string | null;
  position: string;
  correct: boolean;
}

function pctColor(p: number) {
  if (p >= 85) return "#007239";
  if (p >= 70) return "#f97316";
  return "#ef3b24";
}

export default function PositionAccuracyChart({ data }: { data: PositionRow[] }) {
  const [call, setCall] = useState<string>("");

  if (data.length === 0) {
    return (
      <p className="text-sm text-[#6b7c75] py-4 text-center">
        No referee position data yet — upload a game tagged with the REFEREE POSITION label to populate this chart.
      </p>
    );
  }

  const friendly = (raw: string) => POSITION_NAMES[raw] ?? raw;
  const callTypes = [...new Set(data.map((d) => d.call).filter(Boolean))].sort() as string[];
  const rows = call ? data.filter((d) => d.call === call) : data;

  const positionsInData = [...new Set(data.map((d) => friendly(d.position)))];
  const positions = [
    ...POSITION_ORDER.filter((p) => positionsInData.includes(p)),
    ...positionsInData.filter((p) => !POSITION_ORDER.includes(p)),
  ];

  return (
    <div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-[#6b7c75] mb-1">Decision type</label>
        <select
          value={call}
          onChange={(e) => setCall(e.target.value)}
          className="border border-[#e2e8e5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007239] bg-white min-w-44"
        >
          <option value="">All Calls</option>
          {callTypes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {positions.map((pos) => {
          const posRows = rows.filter((d) => friendly(d.position) === pos);
          const total = posRows.length;
          const correct = posRows.filter((d) => d.correct).length;
          const pct = total > 0 ? Math.round((correct / total) * 100) : null;
          return (
            <div key={pos} className="flex items-center gap-3">
              <span className="w-28 md:w-32 shrink-0 text-xs font-medium text-[#002e23]">{pos}</span>
              <div className="flex-1 h-4 rounded bg-[#f0f4f2] overflow-hidden">
                {pct !== null && (
                  <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: pctColor(pct) }} />
                )}
              </div>
              <div className="w-24 shrink-0 text-right">
                {pct !== null ? (
                  <>
                    <span className="text-xs font-bold" style={{ color: pctColor(pct) }}>{pct}%</span>
                    <span className="text-[10px] text-[#6b7c75] ml-1">{correct}/{total}</span>
                  </>
                ) : (
                  <span className="text-xs text-[#6b7c75]">no calls</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
