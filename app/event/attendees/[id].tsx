
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import * as Brand from "@/constants/Colors";

interface Attendee {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function AttendeesScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("");

  useEffect(() => {
    const fetchAttendees = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch event title
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("title")
          .eq("id", id)
          .single();

        if (!eventError && eventData) {
          setEventTitle(eventData.title);
        }

        // Fetch attendees with their profile info
        const { data, error } = await supabase
          .from("event_going")
          .select(`
            user_id,
            profiles:user_id (
              id,
              username,
              avatar_url
            )
          `)
          .eq("event_id", id);

        if (error) {
          console.error("[Attendees] Error fetching attendees:", error);
          setAttendees([]);
          return;
        }

        // Transform data to flat structure
        const attendeesList = (data || [])
          .map((item: any) => item.profiles)
          .filter((profile: any) => profile !== null);

        setAttendees(attendeesList);
      } catch (err: any) {
        console.error("[Attendees] Error:", err);
        setAttendees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendees();
  }, [id]);

  const renderAttendee = ({ item }: { item: Attendee }) => {
    const usernameDisplay = item.username || "Neznano";

    return (
      <View style={[styles.attendeeCard, { backgroundColor: theme.colors.card }]}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
            <IconSymbol
              ios_icon_name="person.fill"
              android_material_icon_name="person"
              size={24}
              color={Brand.primaryGradientStart}
            />
          </View>
        )}
        <Text style={[styles.username, { color: theme.colors.text }]}>
          {usernameDisplay}
        </Text>
      </View>
    );
  };

  const attendeeCountText = `${attendees.length} ${attendees.length === 1 ? 'oseba' : attendees.length === 2 ? 'osebi' : attendees.length === 3 || attendees.length === 4 ? 'osebe' : 'oseb'}`;

  return (
    <>
      <Stack.Screen
        options={{
          title: eventTitle || "Udeleženci",
          headerShown: true,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["bottom"]}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.headerSubtitle, { color: Brand.textSecondary }]}>
                {attendeeCountText}
              </Text>
            </View>
            <FlatList
              data={attendees}
              renderItem={renderAttendee}
              keyExtractor={(item, index) => item?.id || `attendee-${index}`}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <IconSymbol
                    ios_icon_name="person.2.slash"
                    android_material_icon_name="people-outline"
                    size={64}
                    color={Brand.textSecondary}
                  />
                  <Text style={[styles.emptyText, { color: theme.colors.text }]}>
                    Še ni udeležencev
                  </Text>
                </View>
              }
            />
          </>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Brand.borderSubtle,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  attendeeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontSize: 16,
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
});
