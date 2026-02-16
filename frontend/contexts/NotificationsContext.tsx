import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import React, { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { supabase } from "@/app/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  configureNotificationsOnce,
  ensureNotificationPermission,
  presentNewEventNotification,
} from "@/utils/notifications";

const NOTIF_PROMPT_KEY = "eventfinder:prompted-notifications";

type NotificationsContextValue = {
  ensurePermission: (promptIfNeeded?: boolean) => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  // Supabase generated types in this repo are currently empty, which makes `.from()`
  // accept `never`. Use an `any` client here to keep notifications logic unblocked.
  const sb = supabase as any;

  const followedOrganizerIdsRef = useRef<Set<string>>(new Set());
  const channelsRef = useRef<{ events?: any; follows?: any } | null>(null);

  useEffect(() => {
    configureNotificationsOnce();

    const promptOnce = async () => {
      try {
        const already = await AsyncStorage.getItem(NOTIF_PROMPT_KEY);
        if (already) return;

        // Mark as prompted regardless of user choice to avoid repeated prompts.
        await AsyncStorage.setItem(NOTIF_PROMPT_KEY, "1");
        await ensureNotificationPermission(true);
      } catch (err) {
        console.error("[Notifications] Prompt once failed:", err);
      }
    };

    promptOnce();

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const eventId = (response.notification.request.content.data as any)?.eventId as string | undefined;
      if (eventId) {
        router.push(`/event/${eventId}` as any);
      }
    });

    return () => {
      responseSub.remove();
    };
  }, [router]);

  useEffect(() => {
    const cleanup = async () => {
      try {
        if (channelsRef.current?.events) {
          await sb.removeChannel(channelsRef.current.events);
        }
        if (channelsRef.current?.follows) {
          await sb.removeChannel(channelsRef.current.follows);
        }
      } catch {
        // ignore
      } finally {
        channelsRef.current = null;
        followedOrganizerIdsRef.current = new Set();
      }
    };

    if (!user) {
      cleanup();
      return;
    }

    let cancelled = false;

    const loadFollows = async () => {
      try {
        const { data, error } = await sb
          .from("organizer_followers")
          .select("organizer_id")
          .eq("user_id", user.id);

        if (error) throw error;

        const ids = new Set<string>((data || []).map((row: any) => row.organizer_id).filter(Boolean));
        followedOrganizerIdsRef.current = ids;
      } catch (err) {
        console.error("[Notifications] Failed loading follows:", err);
      }
    };

    const setupRealtime = async () => {
      await loadFollows();
      if (cancelled) return;

      const eventsChannel = sb
        .channel(`realtime:events:new:${user.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "events" },
          async (payload: any) => {
            const newRow = payload.new;
            const organizerId = newRow?.organizer_id as string | undefined;
            const status = newRow?.status as string | undefined;
            const title = (newRow?.title as string | undefined) || "Dogodek";

            if (!organizerId || organizerId === user.id) return;
            if (status !== "published") return;
            if (!followedOrganizerIdsRef.current.has(organizerId)) return;

            // Fetch organizer username for nicer notification body
            let organizerUsername = "Organizator";
            try {
              const { data } = await sb
                .from("profiles")
                .select("username")
                .eq("id", organizerId)
                .maybeSingle();
              if (data?.username) organizerUsername = data.username;
            } catch {
              // ignore
            }

            await presentNewEventNotification({
              eventId: newRow.id,
              organizerUsername,
              eventTitle: title,
            });
          }
        )
        .subscribe();

      const followsChannel = sb
        .channel(`realtime:follows:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "organizer_followers",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            loadFollows();
          }
        )
        .subscribe();

      channelsRef.current = { events: eventsChannel, follows: followsChannel };
    };

    setupRealtime();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [sb, user]);

  const value: NotificationsContextValue = {
    ensurePermission: ensureNotificationPermission,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
