"use client";

const GREEN = "#007239";
const RED = "#ef3b24";

interface RefereeData {
  name: string;
  full_name: string;
  pct: number;
  correct: number;
  incorrect: number;
  total: number;
}

interface CallData {
  call: string;
  correct: number;
  incorrect: number;
  total: number;
}

interface Props {
  refereeData: RefereeData[];
  callBreakdown: CallData[];
  eventParam?: string;
}

function pctColor(p: number) {
  if (p >= 85) return GREEN;
  if (p >= 70) return "#f97316";
  return RED;
}

function Legend() {
  return (
    <div className="flex gap-4 mt-3">
      <span className="flex items-center gap-1.5 text-xs text-[#6b7c75]">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: GREEN }} />
        Correct
      </span>
      <span className="flex items-center gap-1.5 text-xs text-[#6b7c75]">
        <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: RED }} />
        Incorrect
      </span>
    </div>
  );
}

export default function SquadCharts({ refereeData, callBreakdown }: Props) {
  const maxRef = Math.max(...refereeData.map((r) => r.total), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* Horizontal accuracy bars */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6">
        <h3 className="text-sm font-semibold text-[#002e23] mb-4">Referee Accuracy</h3>
        <div className="space-y-4">
          {refereeData.map((r) => {
            const color = pctColor(r.pct);
            return (
              <div key={r.full_name}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-[#002e23]">{r.full_name}</span>
                  <span className="text-xs font-bold" style={{ color }}>{r.pct}%</span>
                </div>
                <div className="h-4 rounded bg-[#f0f4f2] overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${r.pct}%`, backgroundColor: color }} />
                </div>
                <p className="text-xs text-[#6b7c75] mt-0.5">
                  {r.correct} correct · {r.incorrect} incorrect · {r.total} total
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grouped bar chart per referee */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6">
        <h3 className="text-sm font-semibold text-[#002e23] mb-4">Correct vs Incorrect — Per Referee</h3>
        <div className="flex items-end gap-4 h-36">
          {refereeData.map((r) => {
            const cH = (r.correct / maxRef) * 112;
            const iH = (r.incorrect / maxRef) * 112;
            return (
              <div key={r.full_name} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-1 h-28">
                  <div className="w-5 rounded-t" style={{ height: `${cH}px`, backgroundColor: GREEN }} title={`${r.correct} correct`} />
                  <div className="w-5 rounded-t" style={{ height: `${iH}px`, backgroundColor: RED }} title={`${r.incorrect} incorrect`} />
                </div>
                <p className="text-xs text-[#6b7c75] text-center truncate w-full text-center">{r.name}</p>
              </div>
            );
          })}
        </div>
        <Legend />
      </div>

      {/* Call-type breakdown — ranked list, worst accuracy first */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] p-6 lg:col-span-2">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-sm font-semibold text-[#002e23]">Decisions by Call Type</h3>
          <p className="text-xs text-[#6b7c75]">Ranked lowest accuracy first</p>
        </div>
        <div className="space-y-3">
          {[...callBreakdown]
            .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)
            .map((c) => {
              const p = Math.round((c.correct / c.total) * 100);
              return (
                <div key={c.call} className="flex items-center gap-3">
                  <div className="w-32 md:w-40 shrink-0 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#002e23] leading-tight">{c.call}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#f0f4f2] text-[#6b7c75] font-medium shrink-0" title={`${c.total} calls`}>{c.total}</span>
                  </div>
                  <div className="flex-1 h-4 rounded bg-[#f0f4f2] overflow-hidden flex">
                    <div className="h-full" style={{ width: `${(c.correct / c.total) * 100}%`, backgroundColor: GREEN }} title={`${c.correct} correct`} />
                    <div className="h-full" style={{ width: `${(c.incorrect / c.total) * 100}%`, backgroundColor: RED }} title={`${c.incorrect} incorrect`} />
                  </div>
                  <span className="w-10 text-right text-xs font-bold shrink-0" style={{ color: pctColor(p) }}>{p}%</span>
                </div>
              );
            })}
        </div>
        <Legend />
      </div>
    </div>
  );
}
