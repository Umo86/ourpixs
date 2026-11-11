/** Title helpers shared by the wizard (client) and API (server). No server-only imports. */
import { OCCASIONS, type Locale, type OccasionType } from "./config";

const VOWELS = "aeıioöuüAEIİOÖUÜ";
const BACK = "aıouAIOU";

/** Turkish genitive suffix after an apostrophe: Can'ın, Ayşe'nin, Deniz'in, Onur'un, Gül'ün. */
export function trGenitive(word: string): string {
  const w = word.trim();
  const letters = [...w].filter((ch) => /\p{L}/u.test(ch));
  const lastVowel = [...letters].reverse().find((ch) => VOWELS.includes(ch)) || "e";
  const endsWithVowel = !!letters.length && VOWELS.includes(letters[letters.length - 1]!);
  const v = "ouOU".includes(lastVowel) ? "u" : "öüÖÜ".includes(lastVowel) ? "ü" : BACK.includes(lastVowel) ? "ı" : "i";
  return `${endsWithVowel ? "n" : ""}${v}n`;
}

export function joinNames(names: string[]): string {
  const n = names.map((s) => s.trim()).filter(Boolean);
  if (n.length <= 1) return n[0] || "";
  return `${n.slice(0, -1).join(", ")} & ${n[n.length - 1]}`;
}

/** Fills OCCASIONS[type].titlePattern with names, fixing the Turkish suffix (pattern uses 'ın). */
export function suggestTitle(type: OccasionType, names: string[], locale: Locale): string {
  const joined = joinNames(names);
  const pattern = OCCASIONS[type].titlePattern[locale];
  if (!joined) return OCCASIONS[type].label[locale];
  if (locale === "tr" && pattern.includes("{names}'ın")) {
    const last = joined.split(/\s+/).pop() || joined;
    return pattern.replace("{names}'ın", `${joined}'${trGenitive(last)}`);
  }
  return pattern.replace("{names}", joined);
}

/** Two-name occasions. */
export const COUPLE_TYPES: OccasionType[] = ["dugun", "nisan", "yildonumu"];
