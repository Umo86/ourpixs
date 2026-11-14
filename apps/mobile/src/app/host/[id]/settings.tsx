import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { errorMessage, hostApi } from "@/api/client";
import type { OccasionPatch, ShareLink } from "@/api/types";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field, Segmented, ToggleRow } from "@/components/Form";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Loading, Notice } from "@/components/States";
import { PackageCard } from "@/components/PackageStatus";
import { Heading, Txt } from "@/components/Text";
import { useOccasion } from "@/host/OccasionContext";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { colors, MIN_TOUCH } from "@/theme";

const SHOTS = ["off", "10", "20", "30"] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 14 }}>
      <Txt variant="label" weight="extrabold" muted style={{ textTransform: "uppercase", letterSpacing: 0.8 }}>
        {title}
      </Txt>
      {children}
    </Card>
  );
}

export default function HostSettings() {
  const { t, locale } = useI18n();
  const { id, occasion, stats, patch, refresh } = useOccasion();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkScope, setLinkScope] = useState<"all" | "favourites">("all");
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadLinks = useCallback(async () => {
    try {
      setLinks((await hostApi.shareLinks(id)).links);
    } catch {
      setLinks([]);
    }
  }, [id]);
  useEffect(() => void loadLinks(), [loadLinks]);

  const save = async (key: string, p: OccasionPatch) => {
    setSaving(key);
    try {
      await patch(p);
    } catch (e) {
      Alert.alert(errorMessage(e, t));
    } finally {
      setSaving(null);
    }
  };

  const setPinNow = async () => {
    if (!/^\d{4,8}$/.test(pin)) return setPinError(t("settings.pinInvalid"));
    setPinError(null);
    await save("pin", { pin });
    setPin("");
  };

  const createLink = async () => {
    setSaving("link");
    try {
      setLinks((await hostApi.createShareLink(id, { label: linkLabel.trim() || undefined, scope: linkScope })).links);
      setLinkLabel("");
    } catch (e) {
      Alert.alert(errorMessage(e, t));
    } finally {
      setSaving(null);
    }
  };

  const del = () => {
    if (!occasion || confirm.trim() !== occasion.title.trim()) return;
    Alert.alert(t("settings.deleteTitle"), occasion.title, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await hostApi.remove(id);
            router.replace("/host");
          } catch (e) {
            Alert.alert(errorMessage(e, t));
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (!occasion) {
    return (
      <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} />} bottomInset={false}>
        <Loading />
      </Screen>
    );
  }

  const shotsValue = occasion.disposableShots ? (String(occasion.disposableShots) as (typeof SHOTS)[number]) : "off";
  const isOwner = occasion.role === "owner";

  return (
    <Screen header={<AppHeader tone="light" back={() => router.replace("/host")} title={occasion.title} />} scroll bottomInset={false} keyboard>
      <Heading size="lg" accent={t("settings.accent")}>
        {t("settings.title")}
      </Heading>
      {stats ? (
        <Txt muted>
          {t("settings.stats", { photos: stats.photos, videos: stats.videos, guests: stats.guests })}
          {occasion.storageExpiresAt ? `\n${t("settings.storage", { date: formatDate(occasion.storageExpiresAt, locale) })}` : ""}
        </Txt>
      ) : null}

      {/* Gallery status and window. Neutral: no prices or pay buttons in the app (App Store 3.1.1 / Play billing). */}
      <PackageCard occasion={occasion} onChanged={() => refresh()} />

      <Section title={t("settings.albumSection")}>
        <ToggleRow label={t("settings.approval")} help={t("settings.approvalHelp")} value={occasion.approvalMode} disabled={saving === "approval"} onChange={(v) => void save("approval", { approvalMode: v })} />
        <View style={{ gap: 8 }}>
          <Txt weight="bold">{t("settings.reveal")}</Txt>
          <Segmented
            label={t("settings.reveal")}
            value={occasion.revealMode}
            onChange={(v) => void save("reveal", { revealMode: v })}
            options={[
              { value: "live", label: t("settings.revealLive") },
              { value: "next_morning", label: t("settings.revealMorning") },
            ]}
          />
          <Txt variant="small" muted>
            {t("settings.revealHelp")}
          </Txt>
        </View>
      </Section>

      <Section title={t("settings.pin")}>
        <Txt variant="small" muted>
          {t("settings.pinHelp")}
        </Txt>
        {occasion.hasPin ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon name="lock" size={20} color={colors.blue} />
            <Txt weight="bold" style={{ flex: 1 }}>
              {t("settings.pinSet")}
            </Txt>
            <Button full={false} size="sm" variant="ghost" label={t("settings.removePin")} loading={saving === "pin"} onPress={() => void save("pin", { pin: null })} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Field label={t("settings.pin")} placeholder={t("settings.pinPlaceholder")} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" maxLength={8} error={pinError} secureTextEntry={false} />
            <Button label={t("settings.setPin")} icon="lock" size="md" loading={saving === "pin"} disabled={pin.length < 4} onPress={() => void setPinNow()} />
          </View>
        )}
      </Section>

      <Section title={t("settings.disposable")}>
        <Txt variant="small" muted>
          {t("settings.disposableHelp")}
        </Txt>
        <Segmented
          label={t("settings.disposable")}
          value={shotsValue}
          onChange={(v) => void save("shots", { disposableShots: v === "off" ? null : Number(v) })}
          options={SHOTS.map((s) => ({ value: s, label: s === "off" ? t("common.off") : s }))}
        />
      </Section>

      <Section title={t("settings.shareLinks")}>
        <Txt variant="small" muted>
          {t("settings.shareLinksHelp")}
        </Txt>
        {links === null ? (
          <Loading />
        ) : (
          <>
            {links.length === 0 ? (
              <Txt variant="small" muted>
                {t("settings.noLinks")}
              </Txt>
            ) : (
              links.map((l) => (
                <Pressable
                  key={l.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("common.copy")}: ${l.label ?? l.url}`}
                  onPress={() => void Clipboard.setStringAsync(l.url).then(() => Alert.alert(t("common.copied"), l.url))}
                  style={styles.link}
                >
                  <Icon name="link" size={18} color={colors.blue} />
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" numberOfLines={1}>
                      {l.label ?? (l.scope === "favourites" ? t("settings.scopeFavourites") : t("settings.scopeAll"))}
                    </Txt>
                    <Txt variant="caption" muted numberOfLines={1}>
                      {l.url}
                      {l.expiresAt ? ` · ${t("settings.expires", { date: formatDate(l.expiresAt, locale) })}` : ""}
                    </Txt>
                  </View>
                  <Icon name="copy" size={18} color={colors.text2} />
                </Pressable>
              ))
            )}
            <Field label={t("settings.linkLabel")} placeholder={t("settings.linkLabelPlaceholder")} value={linkLabel} onChangeText={setLinkLabel} />
            <Segmented
              label={t("settings.shareLinks")}
              value={linkScope}
              onChange={setLinkScope}
              options={[
                { value: "all", label: t("settings.scopeAll") },
                { value: "favourites", label: t("settings.scopeFavourites") },
              ]}
            />
            <Button label={t("settings.newLink")} icon="plus" size="md" loading={saving === "link"} onPress={() => void createLink()} />
          </>
        )}
      </Section>

      {isOwner ? (
        <Section title={t("settings.danger")}>
          <Txt variant="small" muted>
            {t("settings.deleteBody")}
          </Txt>
          <Field label={t("settings.deleteConfirmPlaceholder")} placeholder={occasion.title} value={confirm} onChangeText={setConfirm} autoCapitalize="none" />
          <Button label={t("settings.deleteEvent")} variant="danger" icon="trash" loading={deleting} disabled={confirm.trim() !== occasion.title.trim()} onPress={del} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: MIN_TOUCH, paddingVertical: 6 },
});
