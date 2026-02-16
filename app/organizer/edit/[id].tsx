
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams, Redirect } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/app/integrations/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/feedback/Toast";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAuth } from "@/contexts/AuthContext";
import * as Brand from "@/constants/Colors";
import { resolveStorageUrl } from "@/utils/storage";
import { authenticatedPut, isBackendConfigured } from "@/utils/api";
import { coordsForCity } from "@/utils/geo";

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

export default function EditEventScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  
  // ROUTE GUARD: Block users with role='user' from accessing this screen
  const shouldRedirect = !authLoading && (!user || userRole === 'user');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({
    visible: false,
    message: "",
    type: "info",
  });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    lineup: "",
    posterUrl: "",
    posterPath: "",
    region: "",
    city: "",
    address: "",
    lat: 46.0569,
    lng: 14.5058,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 3600000),
    genre: "electronic",
    ageLabel: "18+",
    priceType: "free",
    price: null as number | null,
    ticketUrl: "",
    status: "draft",
  });

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id || authLoading) {
        return;
      }

      try {
        setLoading(true);
        console.log("[Uredi dogodek] Pridobivanje dogodka:", id);

        const { data, error: fetchError } = await supabase
          .from("events")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) {
          console.error("[Uredi dogodek] Napaka Supabase:", fetchError);
          throw fetchError;
        }

        if (!data) {
          console.error("[Uredi dogodek] Ni podatkov o dogodku");
          setError({
            title: "Napaka",
            message: "Dogodek ni najden",
          });
          setLoading(false);
          return;
        }

        console.log("[Uredi dogodek] Dogodek naložen:", data.title);

        const storedPoster = (data.poster_url as string | null) || "";
        const posterPreview = storedPoster
          ? (await resolveStorageUrl({ bucket: "event-posters", value: storedPoster })) ?? ""
          : "";

        setFormData({
          title: data.title,
          description: data.description || "",
          lineup: data.lineup || "",
          posterUrl: posterPreview,
          posterPath: storedPoster,
          region: data.region,
          city: data.city,
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          startsAt: new Date(data.starts_at),
          endsAt: new Date(data.ends_at),
          genre: data.genre,
          ageLabel: data.age_label,
          priceType: data.price_type,
          price: data.price,
          ticketUrl: data.ticket_url || "",
          status: data.status,
        });
      } catch (err: any) {
        console.error("[Edit Event] Error:", err);
        setError({
          title: "Napaka pri nalaganju dogodka",
          message: err.message || "Dogodka ni bilo mogoče naložiti",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id, authLoading]);

  const handlePosterUpload = async () => {
    try {
      console.log("[Edit Event] Requesting image picker permission");
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        setToast({
          visible: true,
          message: "Dovoljenje za dostop do fotografij je potrebno",
          type: "error",
        });
        return;
      }

      console.log("[Edit Event] Launching image picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      setUploadingPoster(true);
      console.log("[Edit Event] Image selected, uploading to Supabase Storage");

      const image = result.assets[0];
      const uri = image.uri;
      const fileExtFromUri = uri.split("?")[0].split(".").pop();
      const safeExt = fileExtFromUri && fileExtFromUri.length <= 5 ? fileExtFromUri : "jpg";
      const filePath = `${id}/poster.${safeExt}`;

      const mime = image.mimeType || "image/jpeg";
      const sourceUri = image.base64
        ? `data:${mime};base64,${image.base64}`
        : uri;
      const arrayBuffer = await (await fetch(sourceUri)).arrayBuffer();

      console.log("[Edit Event] Uploading to path:", filePath);

      const { error: uploadError } = await supabase.storage
        .from("event-posters")
        .upload(filePath, arrayBuffer, {
          contentType: mime,
          upsert: true,
        });

      if (uploadError) {
        console.error("[Edit Event] Upload error:", uploadError);
        throw uploadError;
      }

      // Keep a resolved URL for preview.
      const { data: signedData } = await supabase.storage
        .from("event-posters")
        .createSignedUrl(filePath, 60 * 60);

      const publicUrl = supabase.storage.from("event-posters").getPublicUrl(filePath).data.publicUrl;
      const previewUrl = signedData?.signedUrl
        ? signedData.signedUrl
        : publicUrl;

      console.log("[Edit Event] Poster uploaded, path:", filePath);

      // Store the public URL in DB for consistency with older rows.
      setFormData((prev) => ({ ...prev, posterUrl: previewUrl, posterPath: publicUrl }));
      setToast({
        visible: true,
        message: "Plakat naložen",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Edit Event] Poster upload error:", err);
      setToast({
        visible: true,
        message: err.message || "Nalaganje plakata ni uspelo",
        type: "error",
      });
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleUpdate = async () => {
    console.log("[Uredi dogodek] Poskus posodobitve dogodka");
    console.log("[Uredi dogodek] Event ID:", id);
    console.log("[Uredi dogodek] Current status:", formData.status);
    console.log("[Uredi dogodek] User role:", userRole);
    
    if (!formData.title || !formData.region || !formData.city || !formData.address) {
      setToast({
        visible: true,
        message: "Prosimo izpolnite vsa obvezna polja (naslov, regija, mesto, naslov)",
        type: "error",
      });
      return;
    }

    if (formData.endsAt <= formData.startsAt) {
      setToast({
        visible: true,
        message: "Čas konca mora biti po času začetka",
        type: "error",
      });
      return;
    }

    if (!id) {
      console.error("[Uredi dogodek] Neveljaven ID dogodka");
      setToast({
        visible: true,
        message: "Neveljaven ID dogodka",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);
      console.log("[Uredi dogodek] Posodabljanje dogodka v Supabase");
      console.log("[Uredi dogodek] Updating status to:", formData.status);

      let resolvedLat = formData.lat;
      let resolvedLng = formData.lng;
      try {
        const fullAddress = `${formData.address}, ${formData.city}, ${formData.region}, Slovenia`;
        const results = await Location.geocodeAsync(fullAddress);
        if (results && results.length > 0) {
          resolvedLat = results[0].latitude;
          resolvedLng = results[0].longitude;
        }
      } catch (geoErr) {
        console.warn("[Uredi dogodek] Geocoding failed, using existing coords:", geoErr);
      }
      
      // RLS policy ensures:
      // - Organizers can only update their own events (organizer_id = auth.uid())
      // - Admins can update any event
      // Prefer backend API (bypasses overly strict Supabase RLS for past events)
      try {
        if (isBackendConfigured()) {
          await authenticatedPut(`/api/events/${id}`, {
            title: formData.title,
            description: formData.description || null,
            lineup: formData.lineup || null,
            posterUrl: formData.posterPath || formData.posterUrl || null,
            region: formData.region,
            city: formData.city,
            address: formData.address,
            lat: resolvedLat,
            lng: resolvedLng,
            startsAt: formData.startsAt.toISOString(),
            endsAt: formData.endsAt.toISOString(),
            genre: formData.genre,
            ageLabel: formData.ageLabel,
            priceType: formData.priceType,
            price: formData.priceType === "paid" ? formData.price : null,
            ticketUrl: formData.ticketUrl || null,
            status: formData.status,
          });
          setToast({ visible: true, message: "Dogodek posodobljen", type: "success" });
          setTimeout(() => router.back(), 800);
          return;
        }
      } catch {
        // fall back to direct Supabase update below
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({
          title: formData.title,
          description: formData.description || null,
          lineup: formData.lineup || null,
          poster_url: formData.posterPath || formData.posterUrl || null,
          region: formData.region,
          city: formData.city,
          address: formData.address,
          lat: resolvedLat,
          lng: resolvedLng,
          starts_at: formData.startsAt.toISOString(),
          ends_at: formData.endsAt.toISOString(),
          genre: formData.genre,
          age_label: formData.ageLabel,
          price_type: formData.priceType,
          price: formData.priceType === "paid" ? formData.price : null,
          ticket_url: formData.ticketUrl || null,
          status: formData.status,
        })
        .eq("id", id);

      if (updateError) {
        console.error("[Uredi dogodek] Napaka Supabase:", updateError);
        console.error("[Uredi dogodek] Error code:", updateError.code);
        console.error("[Uredi dogodek] Error details:", updateError.details);
        console.error("[Uredi dogodek] Error hint:", updateError.hint);
        console.error("[Uredi dogodek] Error message:", updateError.message);
        throw updateError;
      }

      console.log("[Uredi dogodek] Dogodek uspešno posodobljen");
      console.log("[Uredi dogodek] New status:", formData.status);
      
      setToast({
        visible: true,
        message: "Dogodek posodobljen",
        type: "success",
      });

      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err: any) {
      console.error("[Uredi dogodek] Napaka:", err);
      setError({
        title: "Napaka pri posodabljanju dogodka",
        message: err.message || "Dogodka ni bilo mogoče posodobiti",
      });
    } finally {
      setSaving(false);
    }
  };

  if (shouldRedirect) {
    console.log("[Edit Event] Access denied - user role:", userRole);
    return <Redirect href={"/(tabs)/(home)/" as any} />;
  }

  if (authLoading || loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const startDateDisplay = formData.startsAt.toLocaleDateString();
  const startTimeDisplay = formData.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endDateDisplay = formData.endsAt.toLocaleDateString();
  const endTimeDisplay = formData.endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Stack.Screen
        options={{
          title: "Uredi dogodek",
          headerShown: true,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.form}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Naslov *</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Naslov dogodka"
                placeholderTextColor={Brand.textSecondary}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />

              <Text style={[styles.label, { color: theme.colors.text }]}>Opis</Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Opis dogodka (max 4000 znakov)"
                placeholderTextColor={Brand.textSecondary}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
                maxLength={4000}
              />

              <Text style={[styles.label, { color: theme.colors.text }]}>Lineup</Text>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Lineup izvajalcev"
                placeholderTextColor={Brand.textSecondary}
                value={formData.lineup}
                onChangeText={(text) => setFormData({ ...formData, lineup: text })}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: theme.colors.text }]}>Plakat</Text>
              {formData.posterUrl && (
                <Image source={{ uri: formData.posterUrl }} style={styles.posterPreview} />
              )}
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: theme.colors.primary }]}
                onPress={handlePosterUpload}
                disabled={uploadingPoster}
              >
                {uploadingPoster ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={[styles.uploadButtonText, { color: theme.colors.primary }]}>
                    {formData.posterUrl ? "Zamenjaj plakat" : "Naloži plakat"}
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.label, { color: theme.colors.text }]}>Regija * (samo slovenske regije)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SLOVENIAN_REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region}
                    style={[
                      styles.chip,
                      formData.region === region && { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => setFormData({ ...formData, region })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: formData.region === region ? Brand.primaryGradientStart : theme.colors.text },
                      ]}
                    >
                      {region}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: theme.colors.text }]}>Mesto * (samo ime mesta)</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="npr. Ljubljana, Maribor, Celje"
                placeholderTextColor={Brand.textSecondary}
                value={formData.city}
                onChangeText={(text) =>
                  setFormData((prev) => {
                    const mapped = coordsForCity(text);
                    return {
                      ...prev,
                      city: text,
                      lat: mapped?.lat ?? prev.lat,
                      lng: mapped?.lng ?? prev.lng,
                    };
                  })
                }
              />

              <Text style={[styles.label, { color: theme.colors.text }]}>Naslov *</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Polni naslov"
                placeholderTextColor={Brand.textSecondary}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
              />

              <Text style={[styles.label, { color: theme.colors.text }]}>Datum začetka *</Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  {startDateDisplay}
                </Text>
              </TouchableOpacity>
              {showStartDatePicker && (
                <DateTimePicker
                  value={formData.startsAt}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowStartDatePicker(false);
                    if (date) {
                      const newDate = new Date(formData.startsAt);
                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setFormData({ ...formData, startsAt: newDate });
                    }
                  }}
                />
              )}

              <Text style={[styles.label, { color: theme.colors.text }]}>Čas začetka *</Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  {startTimeDisplay}
                </Text>
              </TouchableOpacity>
              {showStartTimePicker && (
                <DateTimePicker
                  value={formData.startsAt}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowStartTimePicker(false);
                    if (date) {
                      const newDate = new Date(formData.startsAt);
                      newDate.setHours(date.getHours(), date.getMinutes());
                      setFormData({ ...formData, startsAt: newDate });
                    }
                  }}
                />
              )}

              <Text style={[styles.label, { color: theme.colors.text }]}>Datum konca *</Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  {endDateDisplay}
                </Text>
              </TouchableOpacity>
              {showEndDatePicker && (
                <DateTimePicker
                  value={formData.endsAt}
                  mode="date"
                  display="default"
                  onChange={(event, date) => {
                    setShowEndDatePicker(false);
                    if (date) {
                      const newDate = new Date(formData.endsAt);
                      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                      setFormData({ ...formData, endsAt: newDate });
                    }
                  }}
                />
              )}

              <Text style={[styles.label, { color: theme.colors.text }]}>Čas konca *</Text>
              <TouchableOpacity
                style={[styles.dateButton, { borderColor: theme.colors.border }]}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={[styles.dateText, { color: theme.colors.text }]}>
                  {endTimeDisplay}
                </Text>
              </TouchableOpacity>
              {showEndTimePicker && (
                <DateTimePicker
                  value={formData.endsAt}
                  mode="time"
                  display="default"
                  onChange={(event, date) => {
                    setShowEndTimePicker(false);
                    if (date) {
                      const newDate = new Date(formData.endsAt);
                      newDate.setHours(date.getHours(), date.getMinutes());
                      setFormData({ ...formData, endsAt: newDate });
                    }
                  }}
                />
              )}

              <Text style={[styles.label, { color: theme.colors.text }]}>Žanr *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {GENRES.map((genre) => (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.chip,
                      formData.genre === genre && { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => setFormData({ ...formData, genre })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: formData.genre === genre ? Brand.primaryGradientStart : theme.colors.text },
                      ]}
                    >
                      {genre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: theme.colors.text }]}>Tip cene *</Text>
              <View style={styles.priceTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.priceTypeButton,
                    formData.priceType === "free" && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setFormData({ ...formData, priceType: "free", price: null })}
                >
                  <Text
                    style={[
                      styles.priceTypeText,
                      { color: formData.priceType === "free" ? Brand.primaryGradientStart : theme.colors.text },
                    ]}
                  >
                    Brezplačno
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.priceTypeButton,
                    formData.priceType === "paid" && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setFormData({ ...formData, priceType: "paid" })}
                >
                  <Text
                    style={[
                      styles.priceTypeText,
                      { color: formData.priceType === "paid" ? Brand.primaryGradientStart : theme.colors.text },
                    ]}
                  >
                    Plačljivo
                  </Text>
                </TouchableOpacity>
              </View>

              {formData.priceType === "paid" && (
                <>
                  <Text style={[styles.label, { color: theme.colors.text }]}>Cena (€)</Text>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    placeholder="10.00"
                    placeholderTextColor={Brand.textSecondary}
                    value={formData.price?.toString() || ""}
                    onChangeText={(text) =>
                      setFormData({ ...formData, price: parseFloat(text) || null })
                    }
                    keyboardType="decimal-pad"
                  />

                  <Text style={[styles.label, { color: theme.colors.text }]}>URL vstopnic</Text>
                  <TextInput
                    style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                    placeholder="https://vstopnice.primer.com"
                    placeholderTextColor={Brand.textSecondary}
                    value={formData.ticketUrl}
                    onChangeText={(text) => setFormData({ ...formData, ticketUrl: text })}
                    autoCapitalize="none"
                  />
                </>
              )}

              <Text style={[styles.label, { color: theme.colors.text }]}>Status *</Text>
              <View style={styles.priceTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.priceTypeButton,
                    formData.status === "draft" && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setFormData({ ...formData, status: "draft" })}
                >
                  <Text
                    style={[
                      styles.priceTypeText,
                      { color: formData.status === "draft" ? Brand.primaryGradientStart : theme.colors.text },
                    ]}
                  >
                    Osnutek
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.priceTypeButton,
                    formData.status === "published" && { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={() => setFormData({ ...formData, status: "published" })}
                >
                  <Text
                    style={[
                      styles.priceTypeText,
                      { color: formData.status === "published" ? Brand.primaryGradientStart : theme.colors.text },
                    ]}
                  >
                    Objavljeno
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.updateButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Brand.primaryGradientStart} />
                ) : (
                  <Text style={styles.updateButtonText}>Posodobi dogodek</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {error && (
          <Modal
            visible={!!error}
            title={error.title}
            message={error.message}
            onClose={() => setError(null)}
          />
        )}

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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: "top",
  },
  posterPreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  uploadButton: {
    height: 50,
    borderWidth: 2,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
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
  dateButton: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  dateText: {
    fontSize: 16,
  },
  priceTypeRow: {
    flexDirection: "row",
    gap: 12,
  },
  priceTypeButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  priceTypeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  updateButton: {
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  updateButtonText: {
    color: Brand.primaryGradientStart,
    fontSize: 16,
    fontWeight: "600",
  },
});
