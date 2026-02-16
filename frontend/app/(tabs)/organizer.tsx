
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useRouter, Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/feedback/Toast";
import { useAuth } from "@/contexts/AuthContext";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Screen } from "@/components/ui/Screen";
import * as Brand from "@/constants/Colors";
import { authenticatedDelete, isBackendConfigured } from "@/utils/api";
import { resolveStorageUrl } from "@/utils/storage";

interface OrganizerEvent {
  id: string;
  title: string;
  description: string;
  poster_url: string | null;
  region: string;
  city: string;
  starts_at: string;
  ends_at: string;
  genre: string;
  price_type: string;
  price: number | null;
  status: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case "published":
      return { backgroundColor: Brand.successGreen };
    case "draft":
      return { backgroundColor: Brand.surfaceElevated };
    case "cancelled":
      return { backgroundColor: Brand.surfaceMuted };
    default:
      return { backgroundColor: Brand.surfaceElevated };
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "published":
      return "OBJAVLJENO";
    case "draft":
      return "OSNUTEK";
    case "cancelled":
      return "PREKLICANO";
    default:
      return status.toUpperCase();
  }
}

export default function OrganizerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userRole, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({
    visible: false,
    message: "",
    type: "info",
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const isAbortLikeError = useCallback((value: any): boolean => {
    const parts = [
      value?.name,
      value?.message,
      value?.details,
      value?.hint,
      value?.code,
      typeof value === 'string' ? value : null,
    ]
      .filter(Boolean)
      .map((p) => String(p).toLowerCase());

    return parts.some((p) => p.includes('abort')) || parts.some((p) => p.includes('aborted'));
  }, []);

  // ROUTE GUARD: Block users with role='user' from accessing this screen
  const shouldRedirect = !authLoading && (!user || userRole === 'user');

  // Fetch organizer events - ALWAYS define at top level
  const fetchOrganizerEvents = useCallback(async () => {
    if (!user || !userRole) {
      setEvents([]);
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      if (!refreshing) {
        setLoading(true);
      }
      
      console.log("[Organizer Screen] Fetching events for role:", userRole);
      
      let query = supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      query = (query as any).abortSignal(abortControllerRef.current.signal);

      // Admin sees ALL events, organizers see only their own
      if (userRole !== "admin") {
        query = query.eq("organizer_id", user.id);
        console.log("[Organizer Screen] Filtering by organizer_id:", user.id);
      } else {
        console.log("[Organizer Screen] Admin - fetching all events");
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        if (isAbortLikeError(fetchError)) {
          return;
        }
        console.error("[Organizer Screen] Fetch error:", fetchError);
        setEvents([]);
        setError({
          title: "Napaka pri nalaganju dogodkov",
          message: fetchError.message || "Dogodkov ni bilo mogoče naložiti",
        });
        return;
      }

      const eventsData = Array.isArray(data) ? data : [];
      console.log("[Organizer Screen] Fetched events count:", eventsData.length);
      // Resolve poster URLs (handles both paths and URLs, supports private buckets)
      const withPosters = await Promise.all(
        eventsData.map(async (e: any) => {
          const poster = await resolveStorageUrl({ bucket: "event-posters", value: e.poster_url });
          return { ...e, poster_url: poster };
        })
      );
      setEvents(withPosters);
    } catch (err: any) {
      if (isAbortLikeError(err)) {
        return;
      }
      console.error("[Organizer Screen] Error:", err);
      setEvents([]);
      setError({
        title: "Napaka pri nalaganju dogodkov",
        message: err.message || "Dogodkov ni bilo mogoče naložiti",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, userRole, refreshing, isAbortLikeError]);

  const hasEventEnded = useCallback((eventLike: { ends_at?: string | null } | null | undefined) => {
    const endsAt = eventLike?.ends_at;
    if (!endsAt) return false;
    const t = new Date(endsAt).getTime();
    if (!Number.isFinite(t)) return false;
    return t < Date.now();
  }, []);

  // Handle delete - ALWAYS define at top level
  const handleDelete = useCallback(async (eventId: string) => {
    if (!eventId) {
      console.error("[Organizer Screen] Invalid event ID");
      setToast({
        visible: true,
        message: "Neveljaven ID dogodka",
        type: "error",
      });
      setDeleteConfirm(null);
      return;
    }

    const eventToDelete = events.find((e) => e.id === eventId);
    if (userRole !== 'admin') {
      if (hasEventEnded(eventToDelete)) {
        setDeleteConfirm(null);
        return;
      }

      // If local state is stale/missing, confirm against DB before deleting.
      if (!eventToDelete) {
        const { data: eventRow, error: eventRowError } = await supabase
          .from('events')
          .select('ends_at')
          .eq('id', eventId)
          .maybeSingle();

        if (!eventRowError && hasEventEnded(eventRow as any)) {
          setDeleteConfirm(null);
          return;
        }
      }
    }

    console.log("[Organizer Screen] ========================================");
    console.log("[Organizer Screen] DELETE OPERATION STARTED");
    console.log("[Organizer Screen] Event ID:", eventId);
    console.log("[Organizer Screen] User ID:", user?.id);
    console.log("[Organizer Screen] User Role:", userRole);
    console.log("[Organizer Screen] ========================================");

    try {
      // Prefer backend API (bypasses overly strict Supabase RLS, e.g. for past events)
      if (isBackendConfigured()) {
        try {
          const resp = await authenticatedDelete(`/api/events/${eventId}`);
          console.log("[Organizer Screen] Backend delete response:", resp);

          setEvents((prevEvents) => prevEvents.filter((e) => e.id !== eventId));
          setToast({ visible: true, message: "Dogodek uspešno izbrisan", type: "success" });
          return;
        } catch (backendErr: any) {
          console.warn(
            "[Organizer Screen] Backend delete failed, falling back to Supabase:",
            backendErr?.message || backendErr
          );
        }
      }

      // Delete from Supabase FIRST, then update UI
      // RLS policy ensures:
      // - Organizers can only delete their own events (organizer_id = auth.uid())
      // - Admins can delete any event
      // Foreign keys with ON DELETE CASCADE ensure related data is removed
      const { data: deleteData, error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId);

      console.log("[Organizer Screen] Delete response data:", deleteData);
      console.log("[Organizer Screen] Delete response error:", deleteError);

      if (deleteError) {
        console.error("[Organizer Screen] ========================================");
        console.error("[Organizer Screen] DELETE FAILED");
        console.error("[Organizer Screen] Error message:", deleteError.message);
        console.error("[Organizer Screen] Error code:", deleteError.code);
        console.error("[Organizer Screen] Error details:", deleteError.details);
        console.error("[Organizer Screen] Error hint:", deleteError.hint);
        console.error("[Organizer Screen] Full error object:", JSON.stringify(deleteError, null, 2));
        console.error("[Organizer Screen] ========================================");
        throw deleteError;
      }
      
      console.log("[Organizer Screen] ========================================");
      console.log("[Organizer Screen] DELETE SUCCESSFUL");
      console.log("[Organizer Screen] Event deleted from database");
      console.log("[Organizer Screen] ========================================");
      
      // Update UI after successful delete
      setEvents((prevEvents) => prevEvents.filter((e) => e.id !== eventId));
      
      setToast({
        visible: true,
        message: "Dogodek uspešno izbrisan",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Organizer Screen] ========================================");
      console.error("[Organizer Screen] DELETE EXCEPTION");
      console.error("[Organizer Screen] Exception message:", err.message);
      console.error("[Organizer Screen] Exception name:", err.name);
      console.error("[Organizer Screen] Full exception:", JSON.stringify(err, null, 2));
      console.error("[Organizer Screen] ========================================");
      setToast({
        visible: true,
        message: err.message || "Dogodka ni bilo mogoče izbrisati",
        type: "error",
      });
    } finally {
      setDeleteConfirm(null);
    }
  }, [user, userRole, events, hasEventEnded]);

  // Render event - ALWAYS define at top level
  const renderEvent = useCallback(({ item, index }: { item: OrganizerEvent; index: number }) => {
    if (!item || !item.id) {
      return null;
    }

    // Display starts_at instead of ends_at
    const startsAtDate = new Date(item.starts_at);
    const dateDisplay = startsAtDate.toLocaleDateString("sl-SI", {
      month: "short",
      day: "numeric",
    });
    
    const timeDisplay = startsAtDate.toLocaleTimeString("sl-SI", {
      hour: "2-digit",
      minute: "2-digit",
    });
    
    const cityText = item.city || "Neznano mesto";
    const regionText = item.region || "Neznana regija";
    const priceText = item.price_type === "free" ? "Brezplačno" : `€${item.price || 0}`;
    const bulletText = "•";
    const isEnded = userRole !== 'admin' && hasEventEnded(item);

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
        <TouchableOpacity
          style={[styles.eventCard, { backgroundColor: Brand.surfaceDark }]}
          onPress={() => router.push(`/event/${item.id}` as any)}
        >
        {item.poster_url && (
          <Image source={{ uri: item.poster_url }} style={styles.eventImage} />
        )}
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventTitle, { color: Brand.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, getStatusColor(item.status)]}>
              <Text style={styles.statusBadgeText}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>

          <View style={styles.eventMeta}>
            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="event"
                size={16}
                color={Brand.accentOrange}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {dateDisplay}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="access-time"
                size={16}
                color={Brand.accentOrange}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {timeDisplay}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="location"
                android_material_icon_name="location-on"
                size={16}
                color={Brand.accentOrange}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {cityText}
              </Text>
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {bulletText}
              </Text>
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {regionText}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="ticket"
                android_material_icon_name="confirmation-number"
                size={16}
                color={Brand.accentOrange}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {priceText}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="music.note"
                android_material_icon_name="music-note"
                size={16}
                color={Brand.accentOrange}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {item.genre}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: Brand.secondaryGradientStart },
                isEnded ? { opacity: 0.5 } : null,
              ]}
              disabled={isEnded}
              onPress={() => {
                if (isEnded) return;
                router.push(`/organizer/edit/${item.id}` as any);
              }}
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color={Brand.accentOrange}
              />
              <Text style={[styles.actionButtonText, { color: Brand.secondaryGradientEnd }]}>
                Uredi
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { borderColor: Brand.dangerRed },
                isEnded ? { opacity: 0.5 } : null,
              ]}
              disabled={isEnded}
              onPress={() => {
                console.log("[Organizer Screen] Delete button pressed for event:", item.id);
                if (isEnded) return;
                setDeleteConfirm(item.id);
              }}
            >
              <IconSymbol
                ios_icon_name="trash"
                android_material_icon_name="delete"
                size={20}
                color={Brand.dangerRed}
              />
              <Text style={[styles.actionButtonText, { color: Brand.dangerRed }]}>
                Izbriši
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      </Animated.View>
    );
  }, [router, userRole, hasEventEnded]);

  // Refresh callback - ALWAYS define at top level
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrganizerEvents();
  }, [fetchOrganizerEvents]);

  // Effect to fetch events
  useEffect(() => {
    if (user && userRole && !authLoading) {
      fetchOrganizerEvents();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user, userRole, authLoading, fetchOrganizerEvents]);

  // Early returns AFTER all hooks
  if (shouldRedirect) {
    console.log("[Organizer Screen] Access denied - user role:", userRole);
    return <Redirect href={"/(tabs)/(home)/" as any} />;
  }

  if (authLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: Brand.primaryGradientStart }]}>
        <ActivityIndicator size="large" color={Brand.accentOrange} />
      </View>
    );
  }

  if (!user) {
    return (
      <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}>
        <View style={styles.emptyContainer}>
          <IconSymbol
            ios_icon_name="person.crop.circle.badge.exclamationmark"
            android_material_icon_name="person-outline"
            size={64}
            color={Brand.textSecondary}
          />
          <Text style={[styles.emptyText, { color: Brand.textPrimary }]}>
            Prijavite se za upravljanje dogodkov
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: Brand.textPrimary }]}>Moji dogodki</Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Brand.accentOrange} />
        </View>
      ) : (
        <FlatList
          data={Array.isArray(events) ? events : []}
          renderItem={renderEvent}
          keyExtractor={(item, index) => item?.id || `event-${index}`}
          contentContainerStyle={[styles.listContent, { paddingBottom: 160 + insets.bottom }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Brand.accentOrange}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol
                ios_icon_name="calendar.badge.plus"
                android_material_icon_name="event-available"
                size={64}
                color={Brand.textSecondary}
              />
              <Text style={[styles.emptyText, { color: Brand.textPrimary }]}>
                Še ni dogodkov
              </Text>
              <Text style={[styles.emptySubtext, { color: Brand.textSecondary }]}>
                Ustvarite svoj prvi dogodek
              </Text>
              <TouchableOpacity
                style={[styles.createButtonLarge, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push("/organizer/create" as any)}
              >
                <Text style={[styles.createButtonText, { color: Brand.primaryGradientStart }]}>Ustvari dogodek</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {error && (
        <Modal
          visible={!!error}
          title={error.title}
          message={error.message}
          onClose={() => setError(null)}
        />
      )}

      {deleteConfirm && (
        <Modal
          visible={!!deleteConfirm}
          title="Izbriši dogodek"
          message="Ali ste prepričani, da želite izbrisati ta dogodek? Tega dejanja ni mogoče razveljaviti."
          type="confirm"
          confirmText="Izbriši"
          onConfirm={() => {
            console.log("[Organizer Screen] User confirmed delete for event:", deleteConfirm);
            handleDelete(deleteConfirm);
          }}
          onClose={() => {
            console.log("[Organizer Screen] User cancelled delete");
            setDeleteConfirm(null);
          }}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary, marginBottom:30}]}
        onPress={() => router.push("/organizer/create" as any)}
      >
        <IconSymbol
          ios_icon_name="plus"
          android_material_icon_name="add"
          size={28}
          color={Brand.primaryGradientStart}
        />
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },
  listContent: {
    padding: 16,
    paddingBottom: 140, // Increased to account for higher FAB
  },
  eventCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  eventImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  eventMeta: {
    gap: 8,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  createButtonLarge: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 24,
    shadowColor: Brand.glowOrange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 80, // MOVED HIGHER: minimum 40px above bottom safe area + tab bar (70px tab bar + 20px margin + 30px buffer = 120px)
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Brand.glowOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
