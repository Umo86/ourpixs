import { useState } from "react";
import { View } from "react-native";

import { errorMessage, guestApi } from "@/api/client";
import { GuestHeader } from "@/components/EventBrand";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Form";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Notice } from "@/components/States";
import { Heading, Txt } from "@/components/Text";
import { useGuest } from "@/guest/GuestContext";
import { useI18n } from "@/i18n";
import { guestUploadsClosed } from "@/lib/uploadsOpen";
import { colors } from "@/theme";

/**
 * Guest guestbook: text notes to the hosts.
 * Voice/video notes need a storage key from the API (`mediaKey`), which the contract does not yet
 * expose a presign route for — those stay on the web guest app for now.
 */
export default function GuestGuestbook() {
  const { t } = useI18n();
  const { slug, auth, occasion } = useGuest();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = guestUploadsClosed(occasion);

  const send = async () => {
    const v = body.trim();
    if (!v || closed) return;
    setBusy(true);
    setError(null);
    try {
      await guestApi.postMessage(slug, auth, { kind: "text", body: v });
      setBody("");
      setSent(true);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tone="dark" scroll keyboard bottomInset={false} header={<GuestHeader occasion={occasion} title={occasion?.title} />}>
      <Heading tone="dark" size="lg" accent={t("guestbook.guestAccent")} accentColor={colors.blueOnDarkSoft}>
        {t("guestbook.guestTitle")}
      </Heading>
      <Txt tone="dark" muted>
        {t("guestbook.empty_body_guest")}
      </Txt>
      {closed ? <Notice tone="dark" icon="lock" text={t("guestbook.closed")} /> : null}
      {sent ? (
        <Card tone="dark" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Icon name="checkCircle" size={22} color={colors.blueOnDarkSoft} />
          <Txt tone="dark" weight="bold" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {t("guestbook.sent")}
          </Txt>
        </Card>
      ) : null}
      <Field
        tone="dark"
        label={t("guestbook.guestTitle") + " " + t("guestbook.guestAccent")}
        placeholder={t("guestbook.placeholder")}
        value={body}
        onChangeText={(v) => {
          setBody(v);
          setSent(false);
        }}
        multiline
        maxLength={1000}
        style={{ minHeight: 160, textAlignVertical: "top" }}
        error={error}
        editable={!closed}
      />
      <View>
        <Button tone="dark" label={t("guestbook.send")} icon="message" loading={busy} disabled={!body.trim() || closed} onPress={() => void send()} />
      </View>
    </Screen>
  );
}
