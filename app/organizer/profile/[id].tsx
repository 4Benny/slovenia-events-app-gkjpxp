
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@/app/integrations/supabase/client";
import { Toast } from "@/components/feedback/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { Modal } from "@/components/ui/Modal";
import * as Notifications from "expo-notifications";
import * as Brand from "@/constants/Colors";
import { InstagramIcon, SnapchatIcon } from "@/components/SocialIcons";

interface OrganizerProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  region: string | null;
  city: string | null;
  instagram_username?: string | null;
  snapchat_username?: string | null;
}

export default function OrganizerProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const organizerId = Array.isArray(id) ? id[0] : id;
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({
    visible: false,
    message: "",
    type: "info",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!organizerId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch organizer profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", organizerId)
          .single();

        if (profileError) {
          throw profileError;
        }

        // Check if user is an organizer
        if (profileData.role !== "organizer" && profileData.role !== "admin") {
          setToast({
            visible: true,
            message: "Ta profil ni organizator",
            type: "error",
          });
          router.back();
          return;
        }

        setProfile(profileData);

        // Check if current user is following
        if (user) {
          const { data: followData, error: followError } = await supabase
            .from("organizer_followers")
            .select("id")
            .eq("organizer_id", organizerId)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!followError && followData) {
            setIsFollowing(true);
          }
        }

        // Get followers count
        const { count: followersCount, error: followersError } = await supabase
          .from("organizer_followers")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", organizerId);

        if (!followersError) {
          setFollowersCount(followersCount || 0);
        }

        // Get events count
        const { count: eventsCount, error: eventsError } = await supabase
          .from("events")
          .select("*", { count: "exact", head: true })
          .eq("organizer_id", organizerId)
          .eq("status", "published");

        if (!eventsError) {
          setEventsCount(eventsCount || 0);
        }
      } catch (err: any) {
        console.error("[Organizer Profile] Error:", err);
        setToast({
          visible: true,
          message: err.message || "Profila ni bilo mogoče naložiti",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [organizerId, user, router]);

  const requestNotificationPermission = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  };

  const handleFollowToggle = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      if (isFollowing) {
        // Unfollow
        const { error: deleteError } = await supabase
          .from("organizer_followers")
          .delete()
          .eq("organizer_id", organizerId)
          .eq("user_id", user.id);

        if (deleteError) {
          throw deleteError;
        }

        setIsFollowing(false);
        setFollowersCount(followersCount - 1);
        setToast({
          visible: true,
          message: "Prenehali ste slediti organizatorju",
          type: "success",
        });
      } else {
        // Follow - request notification permission
        const hasPermission = await requestNotificationPermission();

        if (!hasPermission) {
          setToast({
            visible: true,
            message: "Dovoljenje za obvestila je zavrnjeno. Omogočite ga v nastavitvah za prejemanje obvestil o novih dogodkih.",
            type: "info",
          });
        }

        const { error: insertError } = await supabase
          .from("organizer_followers")
          .insert({
            organizer_id: organizerId as string,
            user_id: user.id,
          });

        if (insertError) {
          throw insertError;
        }

        setIsFollowing(true);
        setFollowersCount(followersCount + 1);
        setToast({
          visible: true,
          message: hasPermission
            ? "Sedaj sledite organizatorju. Prejeli boste obvestila o novih dogodkih."
            : "Sedaj sledite organizatorju.",
          type: "success",
        });
      }
    } catch (err: any) {
      console.error("[Organizer Profile] Follow toggle error:", err);
      setToast({
        visible: true,
        message: err.message || "Posodobitev sledenja ni uspela",
        type: "error",
      });
    }
  };

  const handleViewOrganizerEvents = () => {
    if (!organizerId) return;
    router.push(`/(tabs)/(home)/?organizerId=${organizerId}` as any);
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    router.back();
  };

  const handleGoToAuth = () => {
    setShowAuthModal(false);
    router.push("/auth" as any);
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (showAuthModal) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Organizator",
            headerShown: true,
          }}
        />
        <Modal
          visible={showAuthModal}
          title="Prijava potrebna"
          message="Najprej se morate prijaviti!"
          onClose={handleAuthModalClose}
          actions={[
            {
              text: "Prijava",
              onPress: handleGoToAuth,
              style: "default",
            },
            {
              text: "Prekliči",
              onPress: handleAuthModalClose,
              style: "cancel",
            },
          ]}
        />
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Organizator",
            headerShown: true,
          }}
        />
        <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle"
            android_material_icon_name="error"
            size={64}
            color={Brand.textSecondary}
          />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>Profil ni najden</Text>
        </View>
      </>
    );
  }

  const usernameDisplay = profile.username;
  const locationDisplay = profile.city && profile.region 
    ? `${profile.city}, ${profile.region}` 
    : profile.region || "Neznana lokacija";

  return (
    <>
      <Stack.Screen
        options={{
          title: usernameDisplay,
          headerShown: true,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.profileHeader, { backgroundColor: theme.colors.card }]}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.primary }]}>
                <IconSymbol
                  ios_icon_name="person.fill"
                  android_material_icon_name="person"
                  size={48}
                  color={Brand.primaryGradientStart}
                />
              </View>
            )}
            <Text style={[styles.username, { color: theme.colors.text }]}>{usernameDisplay}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>ORGANIZATOR</Text>
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.stat} onPress={handleViewOrganizerEvents}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{eventsCount}</Text>
                <Text style={[styles.statLabel, { color: Brand.textSecondary }]}>
                  Dogodki
                </Text>
              </TouchableOpacity>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{followersCount}</Text>
                <Text style={[styles.statLabel, { color: Brand.textSecondary }]}>
                  Sledilci
                </Text>
              </View>
            </View>

            {( !user || user.id !== profile.id ) && (
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing 
                    ? { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.primary }
                    : { backgroundColor: theme.colors.primary },
                ]}
                onPress={handleFollowToggle}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    { color: isFollowing ? theme.colors.primary : Brand.primaryGradientStart },
                  ]}
                >
                  {isFollowing ? "Prenehaj slediti" : "Sledi"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Lokacija</Text>
            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={20}
                color={Brand.textSecondary}
              />
              <Text style={[styles.infoText, { color: theme.colors.text }]}>
                {locationDisplay}
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Družbeni mediji</Text>
            {profile.instagram_username ? (
              <View style={[styles.infoRow, profile.snapchat_username ? styles.socialRow : null]}>
                <InstagramIcon size={20} />
                <Text style={[styles.infoText, { color: theme.colors.text }]}>
                  {profile.instagram_username}
                </Text>
              </View>
            ) : null}
            {profile.snapchat_username ? (
              <View style={styles.infoRow}>
                <SnapchatIcon size={20} />
                <Text style={[styles.infoText, { color: theme.colors.text }]}>
                  {profile.snapchat_username}
                </Text>
              </View>
            ) : null}
            {!profile.instagram_username && !profile.snapchat_username ? (
              <Text style={[styles.statLabel, { color: Brand.textSecondary }]}>Ni povezanih družbenih medijev</Text>
            ) : null}
          </View>
        </ScrollView>

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />
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
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    alignItems: "center",
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  username: {
    fontSize: 24,
    fontWeight: "bold",
  },
  roleBadge: {
    backgroundColor: Brand.secondaryGradientEnd,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: Brand.textPrimary,
    fontSize: 12,
    fontWeight: "bold",
  },
  statsRow: {
    flexDirection: "row",
    gap: 32,
    marginTop: 16,
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
  },
  followButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    minWidth: 150,
    alignItems: "center",
  },
  followButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  socialRow: {
    marginBottom: 16,
  },
  infoText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
  },
});
