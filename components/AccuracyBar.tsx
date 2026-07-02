interface AccuracyBarProps {
  correct: number;
  total: number;
  showCounts?: boolean;
}

export default function AccuracyBar({ correct, total, showCounts = true }: AccuracyBarProps) {
  const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
  const incorrect = total - correct;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-2xl font-bold" style={{ color: pct >= 85 ? "#007239" : pct >= 70 ? "#f97316" : "#ef3b24" }}>
          {pct}%
        </span>
        {showCounts && (
          <span className="text-xs text-[#6b7c75]">{correct}/{total} correct</span>
        )}
      </div>
      <div className="h-3 rounded-full bg-[#e2e8e5] overflow-hidden flex">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "#007239" }} />
        <div className="h-full transition-all" style={{ width: `${total === 0 ? 0 : Math.round((incorrect / total) * 100)}%`, backgroundColor: "#ef3b24" }} />
      </div>
    </div>
  );
}
