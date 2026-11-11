import * as Haptics from "expo-haptics";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

import { colors, fonts, MIN_TOUCH, palette, radius, type Tone } from "@/theme";
import { Icon, type IconName } from "./Icon";
import { Txt } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: Variant;
  tone?: Tone;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  size?: "lg" | "md" | "sm";
  full?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pill button. Primary = royal blue, secondary = surface, inverse = white on dark / black on light. */
export function Button({ label, variant = "primary", tone = "light", icon, iconRight, loading, size = "lg", full = true, disabled, style, onPress, ...rest }: ButtonProps) {
  const p = palette(tone);
  const bg: Record<Variant, string> = {
    primary: colors.blue,
    secondary: p.surface2,
    ghost: "transparent",
    danger: tone === "dark" ? "#3A1414" : "#FDECEC",
    inverse: tone === "dark" ? colors.white : colors.black,
  };
  const fg: Record<Variant, string> = {
    primary: colors.white,
    secondary: p.fg,
    ghost: p.fg,
    danger: p.danger,
    inverse: tone === "dark" ? colors.black : colors.white,
  };
  const pad = size === "lg" ? 18 : size === "md" ? 14 : 10;
  const fontSize = size === "lg" ? 17 : size === "md" ? 15 : 14;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg[variant],
          paddingVertical: pad,
          alignSelf: full ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "ghost" ? 1.5 : 0,
          borderColor: p.border,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={fontSize + 3} color={fg[variant]} /> : null}
          <Txt style={{ fontFamily: fonts.extrabold, fontSize, color: fg[variant] }} numberOfLines={1}>
            {label}
          </Txt>
          {iconRight ? <Icon name={iconRight} size={fontSize + 3} color={fg[variant]} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Round icon-only button. Always pass an accessibility label. */
export function IconButton({ icon, label, onPress, tone = "light", variant = "secondary", size = MIN_TOUCH, color, disabled, active }: {
  icon: IconName; label: string; onPress?: () => void; tone?: Tone; variant?: "secondary" | "ghost" | "primary" | "glass";
  size?: number; color?: string; disabled?: boolean; active?: boolean;
}) {
  const p = palette(tone);
  const bg =
    variant === "primary" || active ? colors.blue
      : variant === "ghost" ? "transparent"
        : variant === "glass" ? "rgba(10,10,10,0.55)"
          : p.surface2;
  const fg = variant === "primary" || active || variant === "glass" ? colors.white : color ?? p.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      hitSlop={Math.max(0, (MIN_TOUCH - size) / 2)}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, paddingHorizontal: 22, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
