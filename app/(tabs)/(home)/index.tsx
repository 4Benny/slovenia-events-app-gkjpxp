
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
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Screen } from "@/components/ui/Screen";
import * as Brand from "@/constants/Colors";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { resolveStorageUrl } from "@/utils/storage";
import { CITY_FALLBACK_COORDS, normalizeCityKey, resolveEventCoords } from "@/utils/geo";
import { EventFeedCard } from "@/components/EventFeedCard";
import { parseRouteParam, isLikelyUuid } from "@/utils/validation";

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
  going_count?: number;
  avg_rating?: number | null;
  distance?: number;
}

const GENRES = ["electronic", "rock", "pop", "hip-hop", "techno", "house", "trance", "dnb", "dubstep", "other"];

const SLOVENIAN_REGIONS = [
  "Koroška",
  "Osrednjeslovenska",
  "Primorska",
  "Štajerska",
  "Gorenjska",
  "Dolenjska",
  "Prekmurje",
  "Notranjska",
  "Zasavska",
];

const LOCATION_STORAGE_KEY = "eventfinder_user_location";
const SELECTED_CITY_KEY = "eventfinder_selected_city";
const POLL_INTERVAL = 30000; // 30 seconds

// CITY_FALLBACK_COORDS moved to utils/geo.ts

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { organizerId } = useLocalSearchParams<{ organizerId?: string }>();
  const organizerFilterId = parseRouteParam(organizerId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const locationLoadedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingRef = useRef(false);

  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const getTimeLabel = useCallback((startsAt: string): string => {
    const now = new Date();
    const eventDate = new Date(startsAt);
    
    // Check if today
    if (eventDate.toDateString() === now.toDateString()) {
      return "Danes";
    }
    
    // Calculate days difference
    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Check if this week (within 7 days)
    if (diffDays > 0 && diffDays <= 7) {
      return "Ta teden";
    }
    
    // Calculate weeks difference
    const diffWeeks = Math.floor(diffDays / 7);
    
    if (diffWeeks === 1) {
      return "Čez 1 teden";
    } else if (diffWeeks === 2) {
      return "Čez 2 tedna";
    } else if (diffWeeks > 2) {
      return `Čez ${diffWeeks} tednov`;
    }
    
    return "";
  }, []);

  const loadLocation = useCallback(async () => {
    if (locationLoadedRef.current) {
      return;
    }

    try {
      locationLoadedRef.current = true;
      
      const storedLocation = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (storedLocation) {
        const { lat, lng } = JSON.parse(storedLocation);
        console.log("[Feed] Loaded location from storage:", lat, lng);
        setLocation({ lat, lng });
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        console.log("[Feed] Got location from GPS:", lat, lng);
        setLocation({ lat, lng });

        await AsyncStorage.setItem(
          LOCATION_STORAGE_KEY,
          JSON.stringify({ lat, lng })
        );
      } else {
        const selectedCity = await AsyncStorage.getItem(SELECTED_CITY_KEY);
        const selectedKey = normalizeCityKey(selectedCity);
        if (selectedKey && CITY_FALLBACK_COORDS[selectedKey]) {
          const coords = CITY_FALLBACK_COORDS[selectedKey];
          console.log("[Feed] Using city fallback:", selectedCity, coords);
          setLocation(coords);
          await AsyncStorage.setItem(
            LOCATION_STORAGE_KEY,
            JSON.stringify(coords)
          );
        } else {
          const coords = CITY_FALLBACK_COORDS["slovenia"];
          console.log("[Feed] Using Slovenia fallback:", coords);
          setLocation(coords);
          await AsyncStorage.setItem(
            LOCATION_STORAGE_KEY,
            JSON.stringify(coords)
          );
        }
      }
    } catch (err) {
      console.error("[Feed] Error loading location:", err);
      const coords = CITY_FALLBACK_COORDS["slovenia"];
      setLocation(coords);
    }
  }, []);

  const fetchEvents = useCallback(async (silent = false) => {
    if (!location) {
      console.log("[Feed] No location available, skipping fetch");
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log("[Feed] Fetch already in progress, skipping...");
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    isFetchingRef.current = true;

    try {
      if (!refreshing && !silent) {
        setLoading(true);
      }

      const now = new Date().toISOString();

      if (organizerFilterId && isLikelyUuid(organizerFilterId)) {
        console.log("[Feed] Fetching published events for organizer:", organizerFilterId);
      } else {
        console.log("[Feed] Fetching published upcoming events (ends_at >=", now, ")");
      }

      let query = supabase
        .from("events")
        .select("*")
        .eq("status", "published");

      // Default feed: only events that haven't ended yet.
      // Organizer-filtered feed: show ALL published events for that organizer.
      if (organizerFilterId && isLikelyUuid(organizerFilterId)) {
        query = query.eq('organizer_id', organizerFilterId).order('starts_at', { ascending: false });
      } else {
        query = query.gte("ends_at", now).order("starts_at", { ascending: true });
      }

      query = (query as any).abortSignal(abortControllerRef.current.signal);

      // Only apply interactive filters on the main feed.
      if (!(organizerFilterId && isLikelyUuid(organizerFilterId))) {
        if (selectedRegion) {
          query = query.eq("region", selectedRegion);
        }

        if (selectedGenre) {
          query = query.eq("genre", selectedGenre);
        }

        if (searchQuery) {
          query = query.ilike("title", `%${searchQuery}%`);
        }
      }

      const { data, error } = await query;

      if (error) {
        if (error.message?.includes('aborted')) {
          return;
        }
        console.error("[Feed] Error fetching events:", error);
        setEvents([]);
        return;
      }

      console.log("[Feed] Fetched events count:", data?.length || 0);
      if (data && data.length > 0) {
        console.log("[Feed] Sample event:", data[0].title, "ends_at:", data[0].ends_at);
      }

      let eventsWithDistance = data || [];
      if (location) {
        eventsWithDistance = eventsWithDistance.map((event) => {
          const coords = resolveEventCoords(event);
          if (!coords) {
            return { ...event, distance: undefined };
          }

          return {
            ...event,
            lat: coords.lat,
            lng: coords.lng,
            distance: calculateDistance(location.lat, location.lng, coords.lat, coords.lng),
          };
        });
        eventsWithDistance.sort(
          (a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY)
        );
      }

      const withPosters = await Promise.all(
        (eventsWithDistance || []).map(async (event: any) => ({
          ...event,
          poster_url: await resolveStorageUrl({ bucket: "event-posters", value: event.poster_url }),
        }))
      );

      setEvents(withPosters);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      console.error("[Feed] Error:", err);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [location, selectedRegion, selectedGenre, searchQuery, calculateDistance, refreshing, organizerFilterId]);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  useEffect(() => {
    if (location) {
      console.log("[Feed] Location available, fetching events");
      fetchEvents();

      // Set up polling for new events
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      pollIntervalRef.current = setInterval(() => {
        console.log("[Feed] Auto-refreshing events...");
        fetchEvents(true); // Silent refresh
      }, POLL_INTERVAL);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [location, selectedRegion, selectedGenre, searchQuery, fetchEvents]);

  const onRefresh = useCallback(() => {
    console.log("[Feed] Manual refresh triggered");
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  const handleEventPress = useCallback((eventId: string) => {
    console.log("[Feed] Navigating to event:", eventId);
    router.push(`/event/${eventId}` as any);
  }, [router]);

  const renderEvent = useCallback(({ item }: { item: Event }) => {
    if (!item || !item.id) {
      return null;
    }

    const cityText = item.city || "Neznano mesto";
    const distanceText = item.distance ? `${item.distance.toFixed(1)} km` : "";
    
    const timeLabel = getTimeLabel(item.starts_at);

    return (
      <Animated.View entering={FadeInDown.duration(300).delay(100)}>
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
          badgeText={timeLabel || null}
          onPress={handleEventPress}
          rightMeta={distanceText ? (
            <>
              <Text style={[styles.metaText, { color: Brand.textSecondary, marginHorizontal: 4 }]}>•</Text>
              <Text style={[styles.metaText, { color: Brand.textPrimary }]}>{distanceText}</Text>
            </>
          ) : null}
        />
      </Animated.View>
    );
  }, [handleEventPress, getTimeLabel]);

  const emptyText = "Ni najdenih dogodkov";
  const emptySubtext = "Poskusite prilagoditi filtre ali preverite pozneje";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Brand.textPrimary }]}>Dogodki</Text>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)}>
            <IconSymbol
              ios_icon_name="line.3.horizontal.decrease.circle"
              android_material_icon_name="filter-list"
              size={28}
              color={Brand.accentOrange}
            />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={[styles.filters, { backgroundColor: Brand.surfaceDark, borderColor: Brand.borderSubtle }]}>
            <TextInput
              style={[styles.searchInput, { color: Brand.textPrimary, borderColor: Brand.borderSubtle }]}
              placeholder="Išči dogodke..."
              placeholderTextColor={Brand.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <Text style={[styles.filterLabel, { color: Brand.textPrimary }]}>Žanr</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !selectedGenre && { backgroundColor: Brand.secondaryGradientEnd },
                ]}
                onPress={() => setSelectedGenre("")}
              >
                <Text style={[styles.filterChipText, { color: Brand.textPrimary }]}>
                  Vsi
                </Text>
              </TouchableOpacity>
              {GENRES.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.filterChip,
                    selectedGenre === genre && { backgroundColor: Brand.secondaryGradientEnd },
                  ]}
                  onPress={() => setSelectedGenre(genre)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: Brand.textPrimary },
                    ]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.filterLabel, { color: Brand.textPrimary }]}>Regija</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  !selectedRegion && { backgroundColor: Brand.secondaryGradientEnd },
                ]}
                onPress={() => setSelectedRegion("")}
              >
                <Text style={[styles.filterChipText, { color: Brand.textPrimary }]}>
                  Vse
                </Text>
              </TouchableOpacity>
              {SLOVENIAN_REGIONS.map((region) => (
                <TouchableOpacity
                  key={region}
                  style={[
                    styles.filterChip,
                    selectedRegion === region && { backgroundColor: Brand.secondaryGradientEnd },
                  ]}
                  onPress={() => setSelectedRegion(region)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: Brand.textPrimary },
                    ]}
                  >
                    {region}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {loading && !refreshing ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.centerContainer}>
            <View style={styles.skeletonContainer}>
              {[1, 2, 3].map((index) => (
                <Animated.View
                  key={index}
                  entering={FadeIn.duration(400).delay(index * 100)}
                  style={[styles.skeletonCard, { backgroundColor: Brand.surfaceDark, borderColor: Brand.borderSubtle, borderWidth: 1 }]}
                >
                  <View style={[styles.skeletonImage, { backgroundColor: Brand.surfaceElevated }]} />
                  <View style={styles.skeletonContent}>
                    <View style={[styles.skeletonTitle, { backgroundColor: Brand.surfaceElevated }]} />
                    <View style={[styles.skeletonText, { backgroundColor: Brand.surfaceElevated }]} />
                    <View style={[styles.skeletonText, { backgroundColor: Brand.surfaceElevated, width: "60%" }]} />
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
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
                  ios_icon_name="calendar.badge.exclamationmark"
                  android_material_icon_name="event-busy"
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
  filters: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderSubtle,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipText: {
    fontSize: 14,
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
  skeletonContainer: {
    flex: 1,
    width: "100%",
    padding: 16,
  },
  skeletonCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  skeletonImage: {
    width: "100%",
    height: 200,
  },
  skeletonContent: {
    padding: 16,
    gap: 12,
  },
  skeletonTitle: {
    height: 24,
    borderRadius: 8,
    width: "80%",
  },
  skeletonText: {
    height: 16,
    borderRadius: 6,
    width: "100%",
  },
});
