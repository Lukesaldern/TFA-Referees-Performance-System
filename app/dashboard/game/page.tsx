import { createClient } from "@/utils/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: eventId } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentReferee } = user
    ? await supabase.from("referees").select("id, role").eq("auth_user_id", user.id).maybeSingle()
    : { data: null };
  const isAdmin = currentReferee?.role === "admin";

  // Referees only see games they were involved in (games with their decisions)
  let myGameIds: string[] | null = null;
  if (!isAdmin) {
    const { data: myDecisions } = currentReferee?.id
      ? await supabase
          .from("decision_accuracy")
          .select("game_id")
          .eq("referee_id", currentReferee.id)
      : { data: [] };
    myGameIds = [...new Set((myDecisions ?? []).map((d) => d.game_id).filter(Boolean))];
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, name, starts_on")
    .order("starts_on", { ascending: false });

  const selectedEvent = eventId ?? events?.[0]?.id ?? null;

  let gamesQuery = selectedEvent
    ? supabase
        .from("games")
        .select("id, name, game_date, source_file")
        .eq("event_id", selectedEvent)
        .order("game_date", { ascending: true })
    : null;
  if (gamesQuery && myGameIds !== null) {
    gamesQuery = myGameIds.length > 0 ? gamesQuery.in("id", myGameIds) : null;
  }
  const { data: games } = gamesQuery ? await gamesQuery : { data: [] };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-[#002e23] mb-6">Games</h1>

      {/* Event filter */}
      <div className="flex gap-3 flex-wrap mb-6">
        {(events ?? []).map((e) => (
          <Link
            key={e.id}
            href={`/dashboard/game?event=${e.id}`}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              selectedEvent === e.id
                ? "text-[#002e23] border-transparent"
                : "text-[#6b7c75] border-[#e2e8e5] hover:border-[#007239] hover:text-[#007239]"
            }`}
            style={selectedEvent === e.id ? { backgroundColor: "#ffe600", borderColor: "#ffe600" } : {}}
          >
            {e.name}
          </Link>
        ))}
      </div>

      {/* Games list */}
      <div className="bg-white rounded-xl border border-[#e2e8e5] overflow-hidden">
        {!games || games.length === 0 ? (
          <div className="px-6 py-12 text-center text-[#6b7c75] text-sm">
            No games found for this event.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8e5] text-xs uppercase tracking-wide text-[#6b7c75]">
                <th className="text-left px-6 py-3">Game</th>
                <th className="text-left px-6 py-3">Date</th>
                {isAdmin && <th className="text-left px-6 py-3">File</th>}
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className="border-b border-[#e2e8e5] last:border-0 hover:bg-[#f8faf9]">
                  <td className="px-6 py-4 font-medium text-[#002e23]">{g.name}</td>
                  <td className="px-6 py-4 text-[#6b7c75]">
                    {g.game_date ? new Date(g.game_date).toLocaleDateString("en-AU") : "—"}
                  </td>
                  {isAdmin && <td className="px-6 py-4 text-[#6b7c75] text-xs font-mono">{g.source_file}</td>}
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/game/${g.id}`}
                      className="text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                      style={{ backgroundColor: "#007239" }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
