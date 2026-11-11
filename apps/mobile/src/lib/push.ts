import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { authApi } from "@/api/client";
import { DEMO_MODE } from "@/config";

let handlerSet = false;
export function configureNotificationHandler() {
  if (handlerSet || Platform.OS === "web") return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function notificationsGranted(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const s = await Notifications.getPermissionsAsync();
  return s.granted;
}

/**
 * Asks for permission (only when `prompt`), gets the Expo push token and registers it with the API.
 * Silent no-op on simulators, web, demo mode or when no EAS projectId is configured.
 */
export async function registerForPush({ prompt, channelName }: { prompt: boolean; channelName: string }): Promise<boolean> {
  if (Platform.OS === "web" || DEMO_MODE || !Device.isDevice) return false;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("uploads", {
        name: channelName,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== "granted" && prompt) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return false;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await authApi.registerPushToken(data, Platform.OS === "ios" ? "ios" : "android");
    return true;
  } catch {
    return false;
  }
}
