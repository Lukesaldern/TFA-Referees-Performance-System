"use client";

import { useState } from "react";

interface CallBreakdown {
  call: string;
  correct: number;
  total: number;
  pct: number;
  squad_pct: number | null;
}

interface Stats {
  overall_pct: number;
  correct: number;
  total: number;
  general_pct: number;
  general_correct: number;
  general_total: number;
  critical_pct: number;
  critical_correct: number;
  critical_total: number;
  missed: number;
  games_count: number;
  call_breakdown: CallBreakdown[];
  squad_avg_pct: number;
}

interface AiFeedbackProps {
  refereeName: string;
  stats: Stats;
}

interface Feedback {
  strengths: string[];
  development_areas: string[];
}

export default function AiFeedback({ refereeName, stats }: AiFeedbackProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ai-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referee_name: refereeName, stats }),
    });
    if (res.ok) {
      setFeedback(await res.json());
    } else {
      setError("Could not generate feedback. Check your API key is set.");
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: "#002e23" }}>
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-white">Performance Feedback</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Data-driven insights based on this referee&apos;s coded decisions
          </p>
        </div>
        {!feedback && (
          <button
            onClick={generate}
            disabled={loading || stats.total === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#ffe600", color: "#002e23" }}
          >
            {loading ? "Analysing…" : "Generate Feedback"}
          </button>
        )}
        {feedback && (
          <button
            onClick={() => { setFeedback(null); generate(); }}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white transition-colors"
          >
            Regenerate
          </button>
        )}
      </div>

      {!feedback && !loading && !error && (
        <div className="px-6 py-8 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
          <p className="text-sm">Click &quot;Generate Feedback&quot; to get AI-powered coaching insights based on this referee&apos;s performance data.</p>
        </div>
      )}

      {loading && (
        <div className="px-6 py-8 text-center">
          <div className="inline-block w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.5)" }}>Analysing performance data…</p>
        </div>
      )}

      {error && (
        <div className="px-6 py-4 text-sm" style={{ color: "#ef3b24" }}>{error}</div>
      )}

      {feedback && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          {/* Strengths */}
          <div className="px-6 py-5" style={{ backgroundColor: "#002e23" }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: "#ffe600" }}>✓</span>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ffe600" }}>Strengths</p>
            </div>
            <ul className="space-y-3">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  <span className="mt-0.5 shrink-0" style={{ color: "#007239" }}>•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Development areas */}
          <div className="px-6 py-5" style={{ backgroundColor: "#002e23" }}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: "#ef3b24" }}>◎</span>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#ef3b24" }}>Development Areas</p>
            </div>
            <ul className="space-y-3">
              {feedback.development_areas.map((d, i) => (
                <li key={i} className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  <span className="mt-0.5 shrink-0" style={{ color: "#ef3b24" }}>•</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
