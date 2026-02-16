
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { InstagramIcon, SnapchatIcon } from "@/components/SocialIcons";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/feedback/Toast";
import { useRouter } from "expo-router";
import { supabase } from "@/app/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleLabel, getRoleColor } from "@/constants/Colors";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "@/components/ui/Screen";
import * as Brand from "@/constants/Colors";

interface Profile {
  id: string;
  username: string;
  role: string;
  avatar_url: string | null;
  region: string | null;
  city: string | null;
  show_location: boolean;
  instagram_username: string | null;
  snapchat_username: string | null;
  age: number | null;
  email: string | null;
  attended_events_count: number | null;
  created_at: string;
}

const SLOVENIAN_REGIONS = [
  "koroška",
  "notranjska",
  "osrednjeslovenska",
  "primorska",
  "štajerska",
  "gorenjska",
  "prekmurje",
  "dolenjska",
  "posavska",
];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, userRole, signOut: authSignOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editedProfile, setEditedProfile] = useState<Partial<Profile>>({});
  const [editedEmail, setEditedEmail] = useState("");
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({
    visible: false,
    message: "",
    type: "info",
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      let query = supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      query = (query as any).abortSignal(abortControllerRef.current.signal);

      const { data, error: fetchError } = await query;

      if (fetchError) {
        if (fetchError.message?.includes('aborted')) {
          return;
        }
        throw fetchError;
      }

      setProfile(data);
      setEditedProfile(data);
      setEditedEmail(user?.email || data.email || "");
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }
      setError({
        title: "Napaka pri nalaganju profila",
        message: err.message || "Profila ni bilo mogoče naložiti",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
    } else {
      setProfile(null);
      setLoading(false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [user, fetchProfile]);

  const handleAvatarUpload = async () => {
    if (!user) {
      setToast({ visible: true, message: "Niste prijavljeni", type: "error" });
      return;
    }
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        setToast({
          visible: true,
          message: "Potrebno je dovoljenje za dostop do fotografij",
          type: "error",
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      setUploadingAvatar(true);

      const image = result.assets[0];
      const fileExt = image.uri.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${fileExt}`;

      const response = await fetch(image.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: image.mimeType || "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      await fetchProfile(user.id);
      setToast({
        visible: true,
        message: "Avatar uspešno posodobljen",
        type: "success",
      });
    } catch (err: any) {
      setToast({
        visible: true,
        message: err.message || "Nalaganje avatarja ni uspelo",
        type: "error",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    if (!editedProfile.username || editedProfile.username.length < 3) {
      setToast({
        visible: true,
        message: "Uporabniško ime mora biti dolgo vsaj 3 znake",
        type: "error",
      });
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(editedProfile.username)) {
      setToast({
        visible: true,
        message: "Uporabniško ime lahko vsebuje samo male črke, številke, podčrtaje in pomišljaje",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);

      const canEditEmail = (profile?.role === "organizer" || profile?.role === "admin" || userRole === "organizer" || userRole === "admin");
      
      // Check if username changed and if new username already exists
      if (editedProfile.username !== profile?.username) {
        const { data: existingProfile, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", editedProfile.username.toLowerCase())
          .neq("id", user.id)
          .maybeSingle();

        if (existingProfile) {
          setToast({
            visible: true,
            message: "To uporabniško ime je že zasedeno",
            type: "error",
          });
          setSaving(false);
          return;
        }
      }

      // Check if email changed and if new email already exists (organizer/admin only)
      if (canEditEmail && editedEmail && editedEmail !== user.email && editedEmail !== profile?.email) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", editedEmail.toLowerCase())
          .neq("id", user.id)
          .maybeSingle();

        if (existingProfile) {
          setToast({
            visible: true,
            message: "Ta e-poštni naslov je že registriran",
            type: "error",
          });
          setSaving(false);
          return;
        }
      }
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username: editedProfile.username?.toLowerCase(),
          region: editedProfile.region || null,
          city: editedProfile.city || null,
          show_location: editedProfile.show_location,
          instagram_username: editedProfile.instagram_username || null,
          snapchat_username: editedProfile.snapchat_username || null,
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      // If email changed, update auth email and send verification (organizer/admin only)
      if (canEditEmail && editedEmail && editedEmail !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: editedEmail,
        });

        if (emailError) {
          throw emailError;
        }

        // Update email in profiles table
        await supabase
          .from("profiles")
          .update({ email: editedEmail.toLowerCase() })
          .eq("id", user.id);

        setToast({
          visible: true,
          message: "Profil posodobljen. Preverite svojo e-pošto za potrditev nove e-poštne naslove.",
          type: "success",
        });
      } else {
        setToast({
          visible: true,
          message: "Profil uspešno posodobljen",
          type: "success",
        });
      }

      await fetchProfile(user.id);
      setEditing(false);
    } catch (err: any) {
      setToast({
        visible: true,
        message: err.message || "Posodobitev profila ni uspela",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      setProfile(null);
      router.replace("/(tabs)/(home)/" as any);
    } catch (err) {
      console.error("[Profile] Sign out error:", err);
    } finally {
      setShowSignOutConfirm(false);
    }
  };

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
            Prijavite se za ogled profila
          </Text>
          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: Brand.accentOrange }]}
            onPress={() => router.push("/auth" as any)}
          >
            <Text style={styles.signInButtonText}>Prijava</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}><View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Brand.accentOrange} />
      </View></Screen>
    );
  }

  if (!profile) {
    return (
      <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}><View style={styles.centerContainer}>
        <Text style={[styles.errorText, { color: Brand.textPrimary }]}>
          Profila ni bilo mogoče naložiti
        </Text>
      </View></Screen>
    );
  }

  const emailDisplay = user?.email || profile.email || "";
  const usernameDisplay = profile.username;
  const roleDisplay = getRoleLabel(profile.role);
  const roleBadgeColor = getRoleColor(profile.role);
  const attendedEventsCount = profile.attended_events_count || 0;

  return (
    <Screen edges={["top","bottom"]} contentStyle={styles.screenContent}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== "ios" && styles.contentContainerWithTabBar,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Brand.textPrimary }]}>Profil</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)}>
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={24}
                color={Brand.accentOrange}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={() => {
                  setEditing(false);
                  setEditedProfile(profile);
                  setEditedEmail(user?.email || profile.email || "");
                }}
                style={styles.cancelButton}
              >
                <Text style={[styles.cancelButtonText, { color: Brand.textPrimary }]}>Prekliči</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                style={[styles.saveButton, { backgroundColor: Brand.accentOrange }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Shrani</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <GlassView
          style={[
            styles.profileHeader,
            Platform.OS !== "ios" && {
              backgroundColor: "rgba(30,19,51,0.55)",
            },
          ]}
          glassEffectStyle="regular"
        >
          <TouchableOpacity onPress={handleAvatarUpload} disabled={uploadingAvatar}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <IconSymbol
                ios_icon_name="person.circle.fill"
                android_material_icon_name="person"
                size={80}
                color={Brand.accentOrange}
              />
            )}
            {uploadingAvatar && (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          {editing ? (
            <>
              <TextInput
                style={[styles.input, { color: Brand.textPrimary, borderColor: Brand.borderSubtle }]}
                value={editedProfile.username}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, username: text.toLowerCase() })
                }
                placeholder="Uporabniško ime"
                placeholderTextColor={Brand.textSecondary}
              />
              {(profile.role === "organizer" || profile.role === "admin") && (
                <TextInput
                  style={[styles.input, { color: Brand.textPrimary, borderColor: Brand.borderSubtle }]}
                  value={editedEmail}
                  onChangeText={setEditedEmail}
                  placeholder="E-pošta"
                  placeholderTextColor={Brand.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            </>
          ) : (
            <>
              <Text style={[styles.name, { color: Brand.textPrimary }]}>{usernameDisplay}</Text>
              {(profile.role === "organizer" || profile.role === "admin") && (
                <Text style={[styles.email, { color: Brand.textSecondary }]}>
                  {emailDisplay}
                </Text>
              )}
            </>
          )}
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor }]}>
            <Text style={styles.roleBadgeText}>{roleDisplay}</Text>
          </View>
          
          {profile.role === 'user' && (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: Brand.textPrimary }]}>{attendedEventsCount}</Text>
                <Text style={[styles.statLabel, { color: Brand.textSecondary }]}>
                  Obiskanih dogodkov
                </Text>
              </View>
            </View>
          )}
        </GlassView>

        <GlassView
          style={[
            styles.section,
            Platform.OS !== "ios" && {
              backgroundColor: "rgba(30,19,51,0.55)",
            },
          ]}
          glassEffectStyle="regular"
        >
          <Text style={[styles.sectionTitle, { color: Brand.textPrimary }]}>Lokacija</Text>

          {editing ? (
            <>
              <Text style={[styles.label, { color: Brand.textPrimary }]}>Regija</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SLOVENIAN_REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region}
                    style={[
                      styles.chip,
                      editedProfile.region === region && { backgroundColor: Brand.accentOrange },
                    ]}
                    onPress={() =>
                      setEditedProfile({
                        ...editedProfile,
                        region: editedProfile.region === region ? null : region,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: editedProfile.region === region ? "#fff" : Brand.textPrimary },
                      ]}
                    >
                      {region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: Brand.textPrimary }]}>Mesto (neobvezno)</Text>
              <TextInput
                style={[styles.input, { color: Brand.textPrimary, borderColor: Brand.borderSubtle }]}
                value={editedProfile.city || ""}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, city: text })
                }
                placeholder="Mesto"
                placeholderTextColor={Brand.textSecondary}
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setEditedProfile({
                    ...editedProfile,
                    show_location: !editedProfile.show_location,
                  })
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    editedProfile.show_location && styles.checkboxChecked,
                  ]}
                >
                  {editedProfile.show_location && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabel, { color: Brand.textPrimary }]}>
                  Prikaži mojo lokacijo drugim uporabnikom
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {profile.region && (
                <View style={styles.infoRow}>
                  <IconSymbol
                    ios_icon_name="location.fill"
                    android_material_icon_name="location-on"
                    size={20}
                    color={Brand.textSecondary}
                  />
                  <Text style={[styles.infoText, { color: Brand.textPrimary }]}>
                    {profile.city ? `${profile.city}, ${profile.region}` : profile.region}
                  </Text>
                </View>
              )}
              {!profile.region && (
                <Text style={[styles.emptyTextSmall, { color: Brand.textSecondary }]}>
                  Lokacija ni nastavljena
                </Text>
              )}
            </>
          )}
        </GlassView>

        <GlassView
          style={[
            styles.section,
            Platform.OS !== "ios" && {
              backgroundColor: "rgba(30,19,51,0.55)",
            },
          ]}
          glassEffectStyle="regular"
        >
          <Text style={[styles.sectionTitle, { color: Brand.textPrimary }]}>Družbeni mediji</Text>

          {editing ? (
            <>
              <Text style={[styles.label, { color: Brand.textPrimary }]}>Instagram</Text>
              <TextInput
                style={[styles.input, { color: Brand.textPrimary, borderColor: Brand.borderSubtle }]}
                value={editedProfile.instagram_username || ""}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, instagram_username: text })
                }
                placeholder="Uporabniško ime Instagram"
                placeholderTextColor={Brand.textSecondary}
              />

              <Text style={[styles.label, { color: Brand.textPrimary }]}>Snapchat</Text>
              <TextInput
                style={[styles.input, { color: Brand.textPrimary, borderColor: Brand.borderSubtle }]}
                value={editedProfile.snapchat_username || ""}
                onChangeText={(text) =>
                  setEditedProfile({ ...editedProfile, snapchat_username: text })
                }
                placeholder="Uporabniško ime Snapchat"
                placeholderTextColor={Brand.textSecondary}
              />
            </>
          ) : (
            <>
              {profile.instagram_username && (
                <View style={styles.infoRow}>
                  <InstagramIcon size={20} />
                  <Text style={[styles.infoText, { color: Brand.textPrimary }]}>
                    {profile.instagram_username}
                  </Text>
                </View>
              )}
              {profile.snapchat_username && (
                <View style={styles.infoRow}>
                  <SnapchatIcon size={20} />
                  <Text style={[styles.infoText, { color: Brand.textPrimary }]}>
                    {profile.snapchat_username}
                  </Text>
                </View>
              )}
              {!profile.instagram_username && !profile.snapchat_username && (
                <Text style={[styles.emptyTextSmall, { color: Brand.textSecondary }]}>
                  Ni povezanih družbenih medijev
                </Text>
              )}
            </>
          )}
        </GlassView>

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: Brand.dangerRed }]}
          onPress={() => setShowSignOutConfirm(true)}
        >
          <Text style={styles.signOutButtonText}>Odjava</Text>
        </TouchableOpacity>
      </ScrollView>

      {error && (
        <Modal
          visible={!!error}
          title={error.title}
          message={error.message}
          onClose={() => setError(null)}
        />
      )}

      {showSignOutConfirm && (
        <Modal
          visible={showSignOutConfirm}
          title="Odjava"
          message="Ali ste prepričani, da se želite odjaviti?"
          type="confirm"
          confirmText="Odjava"
          cancelText="Prekliči"
          onConfirm={handleSignOut}
          onClose={() => setShowSignOutConfirm(false)}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: 120 },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  signInButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  signInButtonText: {
    color: Brand.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
  },
  editActions: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  profileHeader: {
    alignItems: "center",
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
  },
  email: {
    fontSize: 16,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: "#fff",
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
    fontSize: 12,
    textAlign: "center",
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoText: {
    fontSize: 16,
  },
  emptyTextSmall: {
    fontSize: 14,
    fontStyle: "italic",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  chipScroll: {
    maxHeight: 50,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    marginRight: 8,
  },
  chipText: {
    fontSize: 14,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: Brand.borderSubtle,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: Brand.secondaryGradientEnd,
    borderColor: Brand.secondaryGradientEnd,
  },
  checkmark: {
    color: Brand.textPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
  checkboxLabel: {
    fontSize: 14,
  },
  signOutButton: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    shadowColor: "#991B1B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  signOutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
  },
});
