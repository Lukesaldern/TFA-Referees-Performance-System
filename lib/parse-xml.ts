import { XMLParser } from "fast-xml-parser";

export interface ParsedLabel {
  group_normalised: string;
  group_raw: string;
  text: string;
}

export interface ParsedDecision {
  instance_id: number;
  start_sec: number;
  end_sec: number;
  call_text: string;           // <code> field — the decision type
  referee_names: string[];     // all REFEREES labels for this instance
  accuracy: string;            // "CORRECT" | "INCORRECT"
  importance: string;          // "CRITICAL" | "GENERAL"
  is_missed: boolean;
  field_position: string | null;
  team_name: string | null;    // populated for TRY events
  labels: ParsedLabel[];
}

export interface ParseResult {
  decisions: ParsedDecision[];
  refereeNames: string[];      // unique across whole file (for assignment UI)
  unknownGroups: Array<{ raw: string; instance_id: number }>;
}

const KNOWN_GROUPS: Record<string, string> = {
  "SEVERITY":       "SEVERITY",
  "TEAMS":          "TEAMS",
  "REFEREES":       "REFEREES",
  "FIELD POSITION": "FIELD_POSITION",
  "FIELD_POSITION": "FIELD_POSITION",
  "ACCURACY":       "ACCURACY",
};

function normaliseGroup(raw: string): string | null {
  return KNOWN_GROUPS[raw.trim().toUpperCase()] ?? null;
}

export function decodePossiblyUtf16(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Detect UTF-16 LE BOM (FF FE)
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder("utf-16le").decode(bytes.slice(2));
  }
  // Detect UTF-16 BE BOM (FE FF)
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder("utf-16be").decode(bytes.slice(2));
  }
  // Check if it looks like UTF-16 LE without BOM (every other byte is 0x00 for ASCII content)
  if (bytes.length > 10 && bytes[1] === 0x00 && bytes[3] === 0x00 && bytes[5] === 0x00) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  // Default to UTF-8
  return new TextDecoder("utf-8").decode(buffer);
}

export function parseSportsCodeXml(buffer: ArrayBuffer): ParseResult {
  const xmlContent = decodePossiblyUtf16(buffer);

  const parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === "label" || name === "instance",
  });

  const root = parser.parse(xmlContent);
  const instances: unknown[] = root?.file?.ALL_INSTANCES?.instance ?? [];
  const decisions: ParsedDecision[] = [];
  const unknownGroups: Array<{ raw: string; instance_id: number }> = [];
  const allRefereeNames = new Set<string>();

  for (const inst of instances) {
    const i = inst as Record<string, unknown>;
    const instanceId = Number(i.ID);
    const callText = String(i.code ?? "").trim();
    const labels: ParsedLabel[] = [];

    // Collect label values by group
    const grouped: Record<string, string[]> = {};
    const rawLabels = Array.isArray(i.label) ? i.label : i.label ? [i.label] : [];

    for (const lbl of rawLabels as Array<Record<string, string>>) {
      const rawGroup = String(lbl.group ?? "").trim();
      const text = String(lbl.text ?? "").trim();
      const normalised = normaliseGroup(rawGroup);

      if (!normalised) {
        unknownGroups.push({ raw: rawGroup, instance_id: instanceId });
        continue;
      }

      labels.push({ group_normalised: normalised, group_raw: rawGroup, text });
      if (!grouped[normalised]) grouped[normalised] = [];
      grouped[normalised].push(text);
    }

    // Extract fields from labels
    const severityText = (grouped["SEVERITY"]?.[0] ?? "").toUpperCase();
    const isMissed = severityText.includes("MISSED");
    const importance = severityText.includes("CRITICAL") ? "CRITICAL" : "GENERAL";

    const accuracyText = (grouped["ACCURACY"]?.[0] ?? "").toUpperCase();
    const accuracy = accuracyText === "INCORRECT" ? "INCORRECT" : "CORRECT";

    const fieldPosition = grouped["FIELD_POSITION"]?.[0] ?? null;
    const teamName = grouped["TEAMS"]?.[0] ?? null;
    const refereeNames = grouped["REFEREES"] ?? [];

    for (const name of refereeNames) {
      if (name) allRefereeNames.add(name);
    }

    decisions.push({
      instance_id: instanceId,
      start_sec: Number(i.start),
      end_sec: Number(i.end),
      call_text: callText,
      referee_names: refereeNames,
      accuracy,
      importance,
      is_missed: isMissed,
      field_position: fieldPosition,
      team_name: teamName,
      labels,
    });
  }

  return {
    decisions,
    refereeNames: [...allRefereeNames],
    unknownGroups,
  };
}
