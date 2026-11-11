import { router } from "expo-router";
import { useRef, useState } from "react";
import { View, type TextInputInstance } from "react-native";

import { ApiError, authApi, errorMessage } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Form";
import { Screen } from "@/components/Screen";
import { Heading, Txt } from "@/components/Text";
import { REVIEW_EMAIL, SHOW_PREVIEW_CODE } from "@/config";
import { useI18n } from "@/i18n";
import { registerForPush } from "@/lib/push";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Login() {
  const { t, locale, brand } = useI18n();
  const { signIn } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const codeRef = useRef<TextInputInstance>(null);
  const normalized = email.trim().toLowerCase();
  const isReview = !!REVIEW_EMAIL && normalized === REVIEW_EMAIL;

  const sendCode = async (resend = false) => {
    if (!EMAIL_RE.test(normalized)) {
      setError(t("auth.invalidEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.requestCode(normalized, locale, brand);
      setPreview(res.previewCode && SHOW_PREVIEW_CODE ? res.previewCode : null);
      setStep("code");
      setInfo(resend ? t("auth.resent") : null);
      setTimeout(() => codeRef.current?.focus(), 250);
    } catch (e) {
      // The App Review account must be able to reach the code step even if email delivery is unavailable.
      if (isReview) setStep("code");
      else setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.verify(normalized, value);
      await signIn(res.token, res.host);
      void registerForPush({ prompt: true, channelName: t("push.channel") });
      router.replace("/host");
    } catch (e) {
      setError(e instanceof ApiError && (e.status === 400 || e.status === 401 || e.status === 422) ? t("auth.invalidCode") : errorMessage(e, t));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tone="light" scroll keyboard header={<AppHeader tone="light" back={step === "code" ? () => setStep("email") : true} />}>
      {step === "email" ? (
        <>
          <Heading size="lg" accent={t("auth.accent")}>
            {t("auth.title")}
          </Heading>
          <Field
            label={t("auth.emailLabel")}
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
            help={t("auth.emailHelp")}
            error={error}
            autoFocus
          />
          <Button label={t("auth.sendCode")} loading={busy} onPress={() => void sendCode()} iconRight="arrowRight" />
        </>
      ) : (
        <>
          <Heading size="lg" accent={t("auth.codeAccent")}>
            {t("auth.codeTitle")}
          </Heading>
          <Txt muted>{t("auth.codeSentTo", { email: normalized })}</Txt>
          {preview ? (
            <Card style={{ padding: 14 }}>
              <Txt weight="bold" selectable>
                {t("auth.previewCode", { code: preview })}
              </Txt>
            </Card>
          ) : null}
          {isReview ? (
            <Txt variant="small" muted>
              {t("auth.reviewHint")}
            </Txt>
          ) : null}
          <Field
            ref={codeRef}
            label={t("auth.codeLabel")}
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              setError(null);
              if (digits.length === 6) void verify(digits);
            }}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            style={{ fontSize: 30, letterSpacing: 10, textAlign: "center" }}
            error={error}
          />
          {info ? (
            <Txt variant="small" muted accessibilityLiveRegion="polite">
              {info}
            </Txt>
          ) : null}
          <Button label={t("auth.verify")} loading={busy} disabled={code.length !== 6} onPress={() => void verify()} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button style={{ flex: 1 }} label={t("auth.resend")} variant="ghost" size="md" onPress={() => void sendCode(true)} disabled={busy} />
            <Button style={{ flex: 1 }} label={t("auth.changeEmail")} variant="ghost" size="md" onPress={() => setStep("email")} disabled={busy} />
          </View>
        </>
      )}
    </Screen>
  );
}
