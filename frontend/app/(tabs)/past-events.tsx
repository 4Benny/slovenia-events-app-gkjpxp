
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Screen } from "@/components/ui/Screen";
import * as Brand from "@/constants/Colors";
import { resolveStorageUrl } from "@/utils/storage";

interface Event {
  id: string;
  title: string;
  description: string;
  poster_url: string | null;
  region: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  starts_at: string;
  ends_at: string;
  genre: string;
  age_label: string;
  price_type: string;
  price: number | null;
  status: string;
  organizer_id: string;
  avg_rating?: number | null;
}

export default function PastEventsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPastEvents = useCallback(async (silent = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      if (!refreshing && !silent) {
        setLoading(true);
      }

      console.log("[Past Events] Fetching past events...");

      const now = new Date();
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

      let query = supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .lt("ends_at", now.toISOString())
        .gte("ends_at", twentyDaysAgo.toISOString())
        .order("ends_at", { ascending: false });

      query = (query as any).abortSignal(abortControllerRef.current.signal);

      const { data, error } = await query;

      if (error) {
        if (error.message?.includes('aborted')) {
          return;
        }
        console.error("[Past Events] Error fetching events:", error);
        setEvents([]);
        return;
      }

      console.log("[Past Events] Fetched events count:", data?.length || 0);

      // Fetch ratings for each event
      const eventsWithRatings = await Promise.all(
        (data || []).map(async (event) => {
          const { data: ratingsData, error: ratingsError } = await supabase
            .from("event_ratings")
            .select("rating")
            .eq("event_id", event.id);

          let avgRating = null;
          if (!ratingsError && ratingsData && ratingsData.length > 0) {
            const sum = ratingsData.reduce((acc, r) => acc + Number(r.rating), 0);
            avgRating = sum / ratingsData.length;
          }

          return {
            ...event,
            poster_url: await resolveStorageUrl({ bucket: "event-posters", value: event.poster_url }),
            avg_rating: avgRating,
          };
        })
      );

      setEvents(eventsWithRatings);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error("[Past Events] Error:", err);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => {
    fetchPastEvents();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPastEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPastEvents();
  }, [fetchPastEvents]);

  const handleEventPress = useCallback((eventId: string) => {
    console.log("[Past Events] Navigating to event:", eventId);
    router.push(`/event/${eventId}` as any);
  }, [router]);

  const renderEvent = useCallback(({ item }: { item: Event }) => {
    if (!item || !item.id) {
      return null;
    }

    // Display starts_at instead of ends_at
    const startsAtDate = new Date(item.starts_at);
    const dateDisplay = startsAtDate.toLocaleDateString("sl-SI", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    
    const cityText = item.city || "Neznano mesto";
    const priceText = item.price_type === "free" ? "Brezplačno" : `€${item.price || 0}`;

    // Calculate how many stars should be yellow based on average rating
    // Show all 5 stars, but only fill the percentage based on average
    const avgRating = item.avg_rating || 0;
    const fullStars = Math.floor(avgRating);
    const partialStar = avgRating - fullStars;

    return (
      <TouchableOpacity
        style={[styles.eventCard, { backgroundColor: Brand.surfaceDark, borderColor: Brand.borderSubtle, borderWidth: 1 }]}
        onPress={() => handleEventPress(item.id)}
        activeOpacity={0.7}
      >
        {item.poster_url && (
          <Image source={{ uri: item.poster_url }} style={styles.eventImage} />
        )}
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={[styles.eventTitle, { color: Brand.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>KONČANO</Text>
            </View>
          </View>

          {item.avg_rating !== null && item.avg_rating !== undefined && (
            <View style={styles.ratingRow}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => {
                  let starColor = Brand.starInactive;
                  
                  if (star <= fullStars) {
                    starColor = Brand.starActive;
                  } else if (star === fullStars + 1 && partialStar > 0) {
                    // For partial star, we'll show it as filled if partial >= 0.5
                    starColor = partialStar >= 0.5 ? Brand.starActive : Brand.starInactive;
                  }
                  
                  const starIcon = starColor === Brand.starActive ? "⭐" : "☆";
                  
                  return (
                    <Text key={star} style={[styles.star, { color: starColor }]}>
                      {starIcon}
                    </Text>
                  );
                })}
              </View>
              <Text style={[styles.ratingText, { color: Brand.textSecondary }]}>
                {item.avg_rating.toFixed(1)}
              </Text>
            </View>
          )}

          <View style={styles.eventMeta}>
            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="calendar"
                android_material_icon_name="event"
                size={16}
                color={Brand.textSecondary}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {dateDisplay}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="music.note"
                android_material_icon_name="music-note"
                size={16}
                color={Brand.textSecondary}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {item.genre}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="ticket"
                android_material_icon_name="confirmation-number"
                size={16}
                color={Brand.textSecondary}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {priceText}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <IconSymbol
                ios_icon_name="location"
                android_material_icon_name="location-on"
                size={16}
                color={Brand.textSecondary}
              />
              <Text style={[styles.metaText, { color: Brand.textSecondary }]}>
                {cityText}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handleEventPress]);

  const emptyText = "Ni preteklih dogodkov";
  const emptySubtext = "Pretekli dogodki se prikažejo tukaj 20 dni po koncu";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Brand.textPrimary }]}>Pretekli dogodki</Text>
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
            contentContainerStyle={[
              styles.listContent,
              Platform.OS !== "ios" && styles.listContentWithTabBar,
            ]}
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
                  ios_icon_name="calendar.badge.clock"
                  android_material_icon_name="history"
                  size={64}
                  color={Brand.textSecondary}
                />
                <Text style={[styles.emptyText, { color: Brand.textSecondary }]}>
                  {emptyText}
                </Text>
                <Text style={[styles.emptySubtext, { color: Brand.textSecondary }]}>
                  {emptySubtext}
                </Text>
              </View>
            }
          />
        )}
      </Screen>
    </>
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
  },
  listContentWithTabBar: {
    paddingBottom: 100,
  },
  eventCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  eventImage: {
    width: "100%",
    height: 200,
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
  badge: {
    backgroundColor: Brand.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: Brand.textSecondary,
    fontSize: 10,
    fontWeight: "bold",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  stars: {
    flexDirection: "row",
    gap: 4,
  },
  star: {
    fontSize: 16,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
  },
  eventMeta: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
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
});
