import { ActivityIndicator, View } from "react-native";

import { useI18n } from "@/i18n";
import { colors, palette, radius, type Tone } from "@/theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Heading, Txt } from "./Text";

export function Loading({ tone = "light" }: { tone?: Tone }) {
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }} accessibilityLabel={t("common.loading")}>
      <ActivityIndicator color={tone === "dark" ? colors.white : colors.blue} size="large" />
    </View>
  );
}

export function EmptyState({ icon, title, body, tone = "light", action }: {
  icon: IconName; title: string; body?: string; tone?: Tone; action?: { label: string; onPress: () => void };
}) {
  const p = palette(tone);
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 14 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: p.surface2, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] }}>
        <Icon name={icon} size={30} color={p.accent} />
      </View>
      <Heading tone={tone} size="sm" center>
        {title}
      </Heading>
      {body ? (
        <Txt tone={tone} muted center>
          {body}
        </Txt>
      ) : null}
      {action ? <Button label={action.label} onPress={action.onPress} tone={tone} full={false} size="md" /> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry, tone = "light" }: { message: string; onRetry?: () => void; tone?: Tone }) {
  const { t } = useI18n();
  return <EmptyState icon="alert" title={message} tone={tone} action={onRetry ? { label: t("common.retry"), onPress: onRetry } : undefined} />;
}

export function ProgressBar({ value, tone = "light", label }: { value: number; tone?: Tone; label?: string }) {
  const p = palette(tone);
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height: 8, borderRadius: radius.pill, backgroundColor: p.surface2, overflow: "hidden" }}
    >
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.blue, borderRadius: radius.pill }} />
    </View>
  );
}

/** Inline notice (account/plan status, info). */
export function Notice({ text, tone = "light", icon = "sparkles", action }: { text: string; tone?: Tone; icon?: IconName; action?: { label: string; onPress: () => void } }) {
  const p = palette(tone);
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 16, borderRadius: 20, backgroundColor: p.surface, alignItems: "center" }}>
      <Icon name={icon} size={20} color={p.accent} />
      <Txt tone={tone} variant="small" style={{ flex: 1 }}>
        {text}
      </Txt>
      {action ? <Button label={action.label} onPress={action.onPress} tone={tone} size="sm" full={false} /> : null}
    </View>
  );
}
