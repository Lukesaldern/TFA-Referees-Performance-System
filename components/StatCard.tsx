interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8e5] p-5 flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b7c75]">{label}</p>
      <p className="text-3xl font-bold" style={{ color: accent ?? "#002e23" }}>{value}</p>
      {sub && <p className="text-xs text-[#6b7c75]">{sub}</p>}
    </div>
  );
}
