import { colors } from "@/theme";
import { Heading, Serif } from "./Text";

/** Event title with the "&" set in Bodoni italic blue, like the web guest app ("Elif & Can"). */
export function TitleWithAmp({ title, size = "xl", tone = "dark" }: { title: string; size?: "xl" | "lg" | "md" | "sm"; tone?: "dark" | "light" }) {
  const parts = title.split(/\s&\s/);
  if (parts.length !== 2) {
    return (
      <Heading tone={tone} size={size}>
        {title}
      </Heading>
    );
  }
  return (
    <Heading tone={tone} size={size}>
      {parts[0]} <Serif color={tone === "dark" ? colors.blueOnDarkSoft : colors.blue}>&amp;</Serif> {parts[1]}
    </Heading>
  );
}
