/** Reads a "|"-separated list from a message string (keeps message files flat strings). */
export function getMessageArray(t: (k: string) => string, key: string): string[] {
  const v = t(key);
  return v === key ? [] : v.split("|").map((s) => s.trim()).filter(Boolean);
}
