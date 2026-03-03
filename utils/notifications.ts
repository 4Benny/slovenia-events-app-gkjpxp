import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

let configured = false;
const GOING_NOTIFS_KEY_PREFIX = "eventfinder:going-notifs:";

export function configureNotificationsOnce() {
  if (configured) return;
  configured = true;

 Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
}

export async function ensureNotificationPermission(promptIfNeeded: boolean = false): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === "granted") return true;

    if (!promptIfNeeded) return false;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === "granted";
  } catch {
    return false;
  }
}

function goingNotifsKey(eventId: string) {
  return `${GOING_NOTIFS_KEY_PREFIX}${eventId}`;
}

export async function cancelGoingReminders(eventId: string) {
  try {
    const key = goingNotifsKey(eventId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;

    const ids: string[] = JSON.parse(raw);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.error("[Notifications] Failed cancelling reminders:", err);
  }
}

export async function scheduleGoingReminders(params: {
  eventId: string;
  eventTitle: string;
  startsAtISO: string;
}) {
  const { eventId, eventTitle, startsAtISO } = params;

  const allowed = await ensureNotificationPermission(false);
  if (!allowed) return;

  // Always clear old ones first (idempotent)
  await cancelGoingReminders(eventId);

  const startsAt = new Date(startsAtISO);
  const now = new Date();

  if (!Number.isFinite(startsAt.getTime())) {
    return;
  }

  const triggers: { date: Date; label: string }[] = [
    { date: new Date(startsAt.getTime() - 3 * 24 * 60 * 60 * 1000), label: "3 dni" },
    { date: new Date(startsAt.getTime() - 1 * 60 * 60 * 1000), label: "1 uro" },
  ].filter((t) => t.date.getTime() > now.getTime());

  if (triggers.length === 0) return;

  try {
    const scheduledIds: string[] = [];

    for (const trigger of triggers) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Opomnik",
          body: `${eventTitle} se začne čez ${trigger.label}.`,
          data: { eventId },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger.date },
      });
      scheduledIds.push(id);
    }

    await AsyncStorage.setItem(goingNotifsKey(eventId), JSON.stringify(scheduledIds));
  } catch (err) {
    console.error("[Notifications] Failed scheduling reminders:", err);
  }
}

export async function presentNewEventNotification(args: {
  eventId: string;
  organizerUsername: string;
  eventTitle: string;
}) {
  const ok = await ensureNotificationPermission(false);
  if (!ok) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: args.eventTitle,
      body: `${args.organizerUsername} je objavil nov dogodek`,
      data: { eventId: args.eventId },
    },
    trigger: null,
  });
}
