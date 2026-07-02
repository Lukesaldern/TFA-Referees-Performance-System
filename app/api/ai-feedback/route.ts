import { NextRequest, NextResponse } from "next/server";

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

function generateFeedback(name: string, stats: Stats) {
  const strengths: string[] = [];
  const development_areas: string[] = [];

  // Overall accuracy
  if (stats.overall_pct >= 90) {
    strengths.push(`Excellent overall accuracy of ${stats.overall_pct}% across ${stats.total} decisions — consistently making the right call under match conditions.`);
  } else if (stats.overall_pct >= 80) {
    strengths.push(`Solid overall accuracy of ${stats.overall_pct}% across ${stats.total} decisions, performing above the squad benchmark.`);
  } else {
    development_areas.push(`Overall accuracy of ${stats.overall_pct}% across ${stats.total} decisions needs improvement — focus on pre-decision positioning to give more time to read the play.`);
  }

  // Critical DM performance
  if (stats.critical_total > 0) {
    if (stats.critical_pct === 100) {
      strengths.push(`Perfect accuracy on all ${stats.critical_total} critical decision moments — performing reliably when it matters most for the match outcome.`);
    } else if (stats.critical_pct >= 85) {
      strengths.push(`Strong critical DM accuracy of ${stats.critical_pct}% (${stats.critical_correct}/${stats.critical_total}) — handling high-pressure match-defining moments well.`);
    } else {
      development_areas.push(`Critical DM accuracy of ${stats.critical_pct}% (${stats.critical_correct}/${stats.critical_total}) is below standard — match-defining decisions need to be a priority focus area.`);
    }
  }

  // General vs Critical gap
  if (stats.general_total > 0 && stats.critical_total > 0) {
    const gap = stats.critical_pct - stats.general_pct;
    if (gap > 15) {
      development_areas.push(`General DM accuracy (${stats.general_pct}%) is ${gap}% lower than critical DM accuracy — attention drops during lower-stakes moments which can accumulate into larger errors.`);
    } else if (stats.general_pct >= stats.critical_pct && stats.general_pct >= 85) {
      strengths.push(`Consistently high accuracy across both general (${stats.general_pct}%) and critical (${stats.critical_pct}%) decisions, showing strong concentration throughout the game.`);
    }
  }

  // Squad overall comparison
  if (stats.squad_avg_pct > 0) {
    const diff = stats.overall_pct - stats.squad_avg_pct;
    if (diff >= 5) {
      strengths.push(`Overall accuracy of ${stats.overall_pct}% is ${diff}% above the squad average of ${stats.squad_avg_pct}% — performing at the top of the group.`);
    } else if (diff <= -5) {
      development_areas.push(`Overall accuracy of ${stats.overall_pct}% is ${Math.abs(diff)}% below the squad average of ${stats.squad_avg_pct}% — focus on closing this gap relative to peers.`);
    }
  }

  // Call types vs squad average
  const callsWithSquad = stats.call_breakdown.filter((c) => c.total >= 2 && c.squad_pct !== null);
  const aboveSquad = callsWithSquad
    .filter((c) => c.pct - (c.squad_pct ?? 0) >= 10)
    .sort((a, b) => (b.pct - (b.squad_pct ?? 0)) - (a.pct - (a.squad_pct ?? 0)));
  if (aboveSquad.length > 0) {
    const best = aboveSquad[0];
    const gap = best.pct - (best.squad_pct ?? 0);
    strengths.push(`${best.call} accuracy of ${best.pct}% is ${gap}% above the squad average of ${best.squad_pct}% — a standout strength relative to peers.`);
  } else {
    // Fall back to absolute best if no squad comparison available
    const goodCalls = stats.call_breakdown.filter((c) => c.pct === 100 && c.total >= 2);
    if (goodCalls.length > 0) {
      const best = goodCalls[0];
      strengths.push(`100% accuracy on ${best.call} calls (${best.total}/${best.total}) — this is a clear area of strength to build confidence from.`);
    }
  }

  const belowSquad = callsWithSquad
    .filter((c) => (c.squad_pct ?? 0) - c.pct >= 10)
    .sort((a, b) => ((a.squad_pct ?? 0) - a.pct) - ((b.squad_pct ?? 0) - b.pct));
  if (belowSquad.length > 0) {
    const worst = belowSquad[belowSquad.length - 1];
    const gap = (worst.squad_pct ?? 0) - worst.pct;
    development_areas.push(`${worst.call} accuracy of ${worst.pct}% is ${gap}% below the squad average of ${worst.squad_pct}% — prioritise this call type in training review.`);
  } else {
    // Fall back to absolute worst
    const poorCalls = stats.call_breakdown
      .filter((c) => c.total >= 2 && c.pct < 75)
      .sort((a, b) => a.pct - b.pct);
    if (poorCalls.length > 0) {
      const worst = poorCalls[0];
      development_areas.push(`${worst.call} accuracy is ${worst.pct}% (${worst.correct}/${worst.total}) — review video clips of these decisions and work on recognition cues with the coaching team.`);
    }
  }

  // Missed decisions
  if (stats.missed === 0 && stats.total >= 10) {
    strengths.push(`Zero missed decision moments across ${stats.total} coded instances — strong positioning and game awareness throughout.`);
  } else if (stats.missed >= 2) {
    development_areas.push(`${stats.missed} missed decision moment${stats.missed > 1 ? "s" : ""} identified — work on tracking play patterns earlier to be in position before decisions arise.`);
  }

  // Trim to 3 each
  return {
    strengths: strengths.slice(0, 3),
    development_areas: development_areas.slice(0, 3),
  };
}

export async function POST(request: NextRequest) {
  const { referee_name, stats } = await request.json();
  if (!referee_name || !stats) {
    return NextResponse.json({ error: "referee_name and stats required" }, { status: 400 });
  }
  const feedback = generateFeedback(referee_name, stats);
  return NextResponse.json(feedback);
}
