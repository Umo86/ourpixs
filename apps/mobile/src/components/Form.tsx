import { forwardRef } from "react";
import { Pressable, StyleSheet, Switch, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { colors, fonts, MIN_TOUCH, palette, radius, type Tone } from "@/theme";
import { Icon } from "./Icon";
import { Txt } from "./Text";

type FieldProps = TextInputProps & { label: string; tone?: Tone; help?: string; error?: string | null };

/** Labelled text input. Label is linked for screen readers via accessibilityLabel. */
export const Field = forwardRef<TextInputInstance, FieldProps>(function Field({ label, tone = "light", help, error, style, ...rest }, ref) {
  const p = palette(tone);
  return (
    <View style={{ gap: 8 }}>
      <Txt tone={tone} variant="label" weight="semibold" muted>
        {label}
      </Txt>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={help}
        placeholderTextColor={tone === "dark" ? "#7D8293" : "#8A8D96"}
        selectionColor={colors.blueOnDark}
        style={[
          styles.input,
          { backgroundColor: tone === "dark" ? colors.surfaceDark : colors.white, color: p.fg, borderColor: error ? p.danger : tone === "dark" ? colors.borderDark : p.border },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Txt tone={tone} variant="small" color={p.danger} accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : help ? (
        <Txt tone={tone} variant="small" muted>
          {help}
        </Txt>
      ) : null}
    </View>
  );
});

/** Checkbox with a label. Whole row is the touch target. */
export function Checkbox({ checked, onChange, label, tone = "light", children }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; tone?: Tone; children?: React.ReactNode;
}) {
  const p = palette(tone);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: MIN_TOUCH, paddingVertical: 4 }}
    >
      <View style={[styles.box, { borderColor: checked ? colors.blue : p.border, backgroundColor: checked ? colors.blue : "transparent" }]}>
        {checked ? <Icon name="check" size={16} color={colors.white} strokeWidth={3} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Txt tone={tone} variant="small" muted>
          {label}
        </Txt>
        {children}
      </View>
    </Pressable>
  );
}

/** Setting row with a switch. */
export function ToggleRow({ label, help, value, onChange, tone = "light", disabled }: {
  label: string; help?: string; value: boolean; onChange: (v: boolean) => void; tone?: Tone; disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: MIN_TOUCH }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt tone={tone} weight="bold">
          {label}
        </Txt>
        {help ? (
          <Txt tone={tone} variant="small" muted>
            {help}
          </Txt>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.blue, false: tone === "dark" ? colors.surfaceDark2 : "#D5D8E2" }}
        thumbColor={colors.white}
        ios_backgroundColor={tone === "dark" ? colors.surfaceDark2 : "#D5D8E2"}
      />
    </View>
  );
}

/** Pill chip used for filters and option pickers. */
export function Chip({ label, selected, onPress, tone = "light" }: { label: string; selected?: boolean; onPress?: () => void; tone?: Tone }) {
  const p = palette(tone);
  const bg = selected ? (tone === "dark" ? colors.white : colors.black) : p.surface2;
  const fg = selected ? (tone === "dark" ? colors.black : colors.white) : p.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}
    >
      <Txt style={{ fontFamily: fonts.bold, fontSize: 14, color: fg }} numberOfLines={1}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Two-or-more option segmented pill. */
export function Segmented<T extends string>({ options, value, onChange, tone = "light", label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; tone?: Tone; label: string;
}) {
  const p = palette(tone);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, { backgroundColor: p.surface2 }]}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, sel && { backgroundColor: tone === "dark" ? colors.white : colors.black }]}
          >
            <Txt style={{ fontFamily: fonts.bold, fontSize: 14, color: sel ? (tone === "dark" ? colors.black : colors.white) : p.fg }} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: fonts.medium, fontSize: 18, paddingHorizontal: 18, paddingVertical: 15, borderWidth: 1.5, borderRadius: radius.input, minHeight: 54 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  chip: { paddingHorizontal: 16, minHeight: 44, borderRadius: radius.pill, justifyContent: "center" },
  seg: { flexDirection: "row", borderRadius: radius.pill, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
});
