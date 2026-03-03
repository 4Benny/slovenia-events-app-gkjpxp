
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
import { EventFeedCard } from "@/components/EventFeedCard";

interface Event {
  id: string;
  title: string;
  description: string;
  lineup?: string | null;
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

    const cityText = item.city || "Neznano mesto";

    return (
      <EventFeedCard
        id={item.id}
        title={item.title}
        posterUrl={item.poster_url}
        startsAt={item.starts_at}
        lineup={item.lineup}
        genre={item.genre}
        priceType={item.price_type}
        price={item.price}
        city={cityText}
        badgeText="KONČANO"
        onPress={handleEventPress}
        rightMeta={
          item.avg_rating !== null && item.avg_rating !== undefined ? (
            <Text style={[styles.metaText, { color: Brand.starActive, marginLeft: 8 }]}>⭐ {item.avg_rating.toFixed(1)}</Text>
          ) : null
        }
      />
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
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
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
