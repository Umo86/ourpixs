import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { ApiError, errorMessage, hostApi } from "@/api/client";
import type { OccasionPatch, ShareLink } from "@/api/types";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card, Pill } from "@/components/Card";
import { Field, Segmented, ToggleRow } from "@/components/Form";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Loading, Notice } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { EXTERNAL_CHECKOUT, formatPrice, MONEY_BACK_DAYS, planSpec, PLANS, UPGRADE_TEK_TO_BUYUK_PENCE } from "@/config";
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

function isPaymentsUnavailable(e: unknown) {
  return e instanceof ApiError && (e.status === 501 || e.status === 503 || /payment|stripe|checkout/i.test(e.code));
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
  const plan = planSpec(occasion?.plan);

  const loadLinks = useCallback(async () => {
    if (!plan.shareLinks) return setLinks([]);
    try {
      setLinks((await hostApi.shareLinks(id)).links);
    } catch {
      setLinks([]);
    }
  }, [id, plan.shareLinks]);
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
    if (!/^\d{4}$/.test(pin)) return setPinError(t("settings.pinInvalid"));
    setPinError(null);
    await save("pin", { pin });
    setPin("");
  };

  const checkout = async (target: "tek" | "buyuk") => {
    setSaving(`plan-${target}`);
    try {
      const { url } = await hostApi.checkout(id, target);
      await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      // Back from the browser: the webhook may already have upgraded the plan.
      await refresh();
    } catch (e) {
      Alert.alert(isPaymentsUnavailable(e) ? t("errors.paymentsSoon") : errorMessage(e, t));
    } finally {
      setSaving(null);
    }
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

  const upgrades: { plan: "tek" | "buyuk"; price: number }[] = !EXTERNAL_CHECKOUT
    ? []
    : occasion.plan === "free"
      ? [{ plan: "tek", price: PLANS.tek.pricePence }, { plan: "buyuk", price: PLANS.buyuk.pricePence }]
      : occasion.plan === "tek"
        ? [{ plan: "buyuk", price: UPGRADE_TEK_TO_BUYUK_PENCE }]
        : [];
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

      <Section title={t("settings.plan")}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Txt weight="extrabold" style={{ flex: 1 }}>
            {t("settings.currentPlan", { plan: PLANS[occasion.plan].name[locale] })}
          </Txt>
          <Pill text={PLANS[occasion.plan].name[locale]} variant="blue" rotate={-4} />
        </View>
        {upgrades.map((u) => (
          <Button
            key={u.plan}
            label={t("settings.upgradeTo", { plan: PLANS[u.plan].name[locale], price: formatPrice(u.price, locale) })}
            icon="sparkles"
            variant={u.plan === "buyuk" ? "primary" : "inverse"}
            loading={saving === `plan-${u.plan}`}
            disabled={!isOwner}
            onPress={() => void checkout(u.plan)}
          />
        ))}
        {upgrades.length ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="checkCircle" size={18} color={colors.blue} />
              <Txt variant="small" weight="bold" style={{ flex: 1 }}>
                {t("settings.guarantee", { days: MONEY_BACK_DAYS })}
              </Txt>
            </View>
            <Txt variant="small" muted>
              {t("settings.upgradeBody")}
            </Txt>
          </View>
        ) : null}
      </Section>

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
            <Field label={t("settings.pin")} placeholder={t("settings.pinPlaceholder")} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} error={pinError} secureTextEntry={false} />
            <Button label={t("settings.setPin")} icon="lock" size="md" loading={saving === "pin"} disabled={pin.length !== 4} onPress={() => void setPinNow()} />
          </View>
        )}
      </Section>

      <Section title={t("settings.disposable")}>
        <Txt variant="small" muted>
          {t("settings.disposableHelp")}
        </Txt>
        {plan.disposable ? (
          <Segmented
            label={t("settings.disposable")}
            value={shotsValue}
            onChange={(v) => void save("shots", { disposableShots: v === "off" ? null : Number(v) })}
            options={SHOTS.map((s) => ({ value: s, label: s === "off" ? t("common.off") : s }))}
          />
        ) : (
          <Notice text={t("errors.planRequired", { plan: PLANS.tek.name[locale] })} icon="lock" />
        )}
      </Section>

      <Section title={t("settings.shareLinks")}>
        <Txt variant="small" muted>
          {t("settings.shareLinksHelp")}
        </Txt>
        {!plan.shareLinks ? (
          <Notice text={t("errors.planRequired", { plan: PLANS.buyuk.name[locale] })} icon="lock" />
        ) : links === null ? (
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
