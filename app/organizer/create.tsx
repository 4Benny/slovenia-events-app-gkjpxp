
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
import { useRouter, Stack, Redirect } from "expo-router";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/app/integrations/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/feedback/Toast";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/contexts/AuthContext";
import * as Brand from "@/constants/Colors";
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

export default function CreateEventScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, userRole, loading: authLoading } = useAuth();
  
  // ROUTE GUARD: Block users with role='user' from accessing this screen
  const shouldRedirect = !authLoading && (!user || userRole === 'user');
  
  const [loading, setLoading] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: "success" | "error" | "info" }>({
    visible: false,
    message: "",
    type: "info",
  });

  // Admin-specific state: organizer selection
  const [organizers, setOrganizers] = useState<{ id: string; username: string }[]>([]);
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<string>("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    lineup: "",
    posterUrl: "",
    posterLocalUri: "",
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

  // If admin, fetch list of organizers for selection
  // If organizer, set their own ID as the organizer
  useEffect(() => {
    const fetchOrganizers = async () => {
      if (userRole !== 'admin' && userRole !== 'organizer') {
        return;
      }

      try {
        if (userRole === 'admin') {
          const { data, error: fetchError } = await supabase
            .from("profiles")
            .select("id, username")
            .eq("role", "organizer")
            .order("username");

          if (fetchError) {
            console.error("[Create Event] Error fetching organizers:", fetchError);
            return;
          }

          setOrganizers(data || []);
        } else if (user) {
          setSelectedOrganizerId(user.id);
        }
      } catch (err: any) {
        console.error("[Create Event] Error fetching organizers:", err);
      }
    };

    if (!authLoading) {
      fetchOrganizers();
    }
  }, [userRole, user, authLoading]);

  const handlePosterSelect = async () => {
    try {
      console.log("[Ustvari dogodek] Zahtevanje dovoljenja za izbiro slike");
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        setToast({
          visible: true,
          message: "Dovoljenje za dostop do fotografij je potrebno",
          type: "error",
        });
        return;
      }

      console.log("[Ustvari dogodek] Odpiranje izbirnika slik");
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

      console.log("[Ustvari dogodek] Slika izbrana");
      const asset = result.assets[0];
      const chosenUri = asset.base64
        ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
        : asset.uri;
      setFormData((prev) => ({ ...prev, posterLocalUri: chosenUri }));
      setToast({
        visible: true,
        message: "Plakat izbran",
        type: "success",
      });
    } catch (err: any) {
      console.error("[Ustvari dogodek] Napaka pri izbiri plakata:", err);
      setToast({
        visible: true,
        message: err.message || "Izbira plakata ni uspela",
        type: "error",
      });
    }
  };

  const handleCreate = async () => {
    console.log("[Ustvari dogodek] Poskus ustvarjanja dogodka");
    console.log("[Ustvari dogodek] User role:", userRole);
    console.log("[Ustvari dogodek] Form data:", {
      title: formData.title,
      region: formData.region,
      city: formData.city,
      address: formData.address,
      status: formData.status,
    });
    
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

    // Admin MUST select an organizer
    if (userRole === 'admin' && !selectedOrganizerId) {
      setToast({
        visible: true,
        message: "Prosimo izberite organizatorja",
        type: "error",
      });
      return;
    }

    try {
      setLoading(true);
      console.log("[Ustvari dogodek] Pridobivanje trenutnega uporabnika");
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error("Ni prijavljenega uporabnika");
      }

      // Determine organizer_id: admin can assign to any organizer, organizer uses their own ID
      const organizerId = userRole === 'admin' ? selectedOrganizerId : currentUser.id;

      console.log("[Ustvari dogodek] Ustvarjanje dogodka v Supabase za organizatorja:", organizerId);
      console.log("[Ustvari dogodek] Current user ID:", currentUser.id);
      console.log("[Ustvari dogodek] Selected organizer ID (admin only):", selectedOrganizerId);

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
        console.warn("[Ustvari dogodek] Geocoding failed, using existing coords:", geoErr);
      }
      
      // INSERT event with all required fields
      // RLS policy ensures:
      // - Organizers can only insert with organizer_id = auth.uid()
      // - Admins can insert with any valid organizer_id (from organizers list)
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({
          organizer_id: organizerId,
          title: formData.title,
          description: formData.description || null,
          lineup: formData.lineup || null,
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
        .select()
        .single();

      if (insertError) {
        console.error("[Ustvari dogodek] Napaka pri vstavljanju:", insertError);
        console.error("[Ustvari dogodek] Error code:", insertError.code);
        console.error("[Ustvari dogodek] Error details:", insertError.details);
        console.error("[Ustvari dogodek] Error hint:", insertError.hint);
        console.error("[Ustvari dogodek] Error message:", insertError.message);
        throw insertError;
      }

      if (!data) {
        console.error("[Ustvari dogodek] Ni podatkov o dogodku po vstavljanju");
        throw new Error("Dogodek ni bil ustvarjen");
      }

      console.log("[Ustvari dogodek] Dogodek uspešno ustvarjen:", data.id);
      console.log("[Ustvari dogodek] Dogodek status:", data.status);

      // If poster was selected, upload it
      if (formData.posterLocalUri) {
        try {
          setUploadingPoster(true);
          console.log("[Ustvari dogodek] Nalaganje plakata invoked");
          
          const uri = formData.posterLocalUri;
          const fileExtFromUri = uri.split("?")[0].split(".").pop();
          const safeExt = fileExtFromUri && fileExtFromUri.length <= 5 ? fileExtFromUri : "jpg";
          const filePath = `${data.id}/poster.${safeExt}`;

          const response = await fetch(uri);
          const arrayBuffer = await response.arrayBuffer();

          console.log("[Ustvari dogodek] Nalaganje na pot:", filePath);

          const { error: uploadError } = await supabase.storage
            .from("event-posters")
            .upload(filePath, arrayBuffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (uploadError) {
            console.error("[Ustvari dogodek] Napaka pri nalaganju:", uploadError);
            throw uploadError;
          }

          console.log("[Ustvari dogodek] Plakat naložen, pot:", filePath);
          console.log("[Ustvari dogodek] Posodabljanje dogodka z URL plakata");

          const publicUrl = supabase.storage.from("event-posters").getPublicUrl(filePath).data.publicUrl;

          const { error: updateError } = await supabase
            .from("events")
            .update({ poster_url: publicUrl })
            .eq("id", data.id);

          if (updateError) {
            console.error("[Ustvari dogodek] Napaka pri posodabljanju:", updateError);
            throw updateError;
          }

          console.log("[Ustvari dogodek] Dogodek posodobljen z URL plakata");
        } catch (posterErr: any) {
          console.error("[Ustvari dogodek] Napaka pri plakatu:", posterErr);
          setToast({
            visible: true,
            message: "Dogodek ustvarjen, vendar nalaganje plakata ni uspelo",
            type: "info",
          });
        } finally {
          setUploadingPoster(false);
        }
      }
      
      setToast({
        visible: true,
        message: "Dogodek uspešno ustvarjen",
        type: "success",
      });

      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (err: any) {
      console.error("[Ustvari dogodek] Napaka:", err);
      setError({
        title: "Napaka pri ustvarjanju dogodka",
        message: err.message || "Dogodka ni bilo mogoče ustvariti",
      });
    } finally {
      setLoading(false);
    }
  };

  if (shouldRedirect) {
    console.log("[Create Event] Access denied - user role:", userRole);
    return <Redirect href={"/(tabs)/(home)/" as any} />;
  }

  if (authLoading) {
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
          title: "Ustvari dogodek",
          headerShown: true,
          headerBackTitleVisible: false,
          headerBackTitle: "",
        } as any}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.form}>
              {userRole === 'admin' && (
                <>
                  <Text style={[styles.label, { color: theme.colors.text }]}>Organizator *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {organizers.map((org) => (
                      <TouchableOpacity
                        key={org.id}
                        style={[
                          styles.chip,
                          selectedOrganizerId === org.id && { backgroundColor: theme.colors.primary },
                        ]}
                        onPress={() => setSelectedOrganizerId(org.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: selectedOrganizerId === org.id ? Brand.primaryGradientStart : theme.colors.text },
                          ]}
                        >
                          {org.username}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

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
              {formData.posterLocalUri && (
                <Image source={{ uri: formData.posterLocalUri }} style={styles.posterPreview} />
              )}
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: theme.colors.primary }]}
                onPress={handlePosterSelect}
                disabled={uploadingPoster}
              >
                {uploadingPoster ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={[styles.uploadButtonText, { color: theme.colors.primary }]}>
                    {formData.posterLocalUri ? "Zamenjaj plakat" : "Naloži plakat"}
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.label, { color: theme.colors.text }]}>Regija * (samo slovenske regije)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {SLOVENIAN_REGIONS.map((region) => (
                  (() => {
                    const isSelected = formData.region === region;
                    return (
                  <TouchableOpacity
                    key={region}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, region })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? Brand.textPrimary : theme.colors.text },
                      ]}
                    >
                      {region}
                    </Text>
                  </TouchableOpacity>
                    );
                  })()
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
                      setFormData((prev) => {
                        const newStartsAt = new Date(prev.startsAt);
                        newStartsAt.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

                        let newEndsAt = prev.endsAt;
                        if (newEndsAt.getTime() <= newStartsAt.getTime()) {
                          newEndsAt = new Date(newStartsAt.getTime() + 2 * 60 * 60 * 1000);
                        }

                        return { ...prev, startsAt: newStartsAt, endsAt: newEndsAt };
                      });
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
                      setFormData((prev) => {
                        const newStartsAt = new Date(prev.startsAt);
                        newStartsAt.setHours(date.getHours(), date.getMinutes(), 0, 0);

                        let newEndsAt = prev.endsAt;
                        if (newEndsAt.getTime() <= newStartsAt.getTime()) {
                          newEndsAt = new Date(newStartsAt.getTime() + 2 * 60 * 60 * 1000);
                        }

                        return { ...prev, startsAt: newStartsAt, endsAt: newEndsAt };
                      });
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
                      setFormData((prev) => {
                        const newEndsAt = new Date(prev.endsAt);
                        newEndsAt.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                        // Ensure end >= start
                        if (newEndsAt.getTime() <= prev.startsAt.getTime()) {
                          return { ...prev, endsAt: new Date(prev.startsAt.getTime() + 2 * 60 * 60 * 1000) };
                        }
                        return { ...prev, endsAt: newEndsAt };
                      });
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
                      setFormData((prev) => {
                        const newEndsAt = new Date(prev.endsAt);
                        newEndsAt.setHours(date.getHours(), date.getMinutes(), 0, 0);
                        if (newEndsAt.getTime() <= prev.startsAt.getTime()) {
                          return { ...prev, endsAt: new Date(prev.startsAt.getTime() + 2 * 60 * 60 * 1000) };
                        }
                        return { ...prev, endsAt: newEndsAt };
                      });
                    }
                  }}
                />
              )}

              <Text style={[styles.label, { color: theme.colors.text }]}>Žanr *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {GENRES.map((genre) => (
                  (() => {
                    const isSelected = formData.genre === genre;
                    return (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, genre })}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? Brand.textPrimary : theme.colors.text },
                      ]}
                    >
                      {genre}
                    </Text>
                  </TouchableOpacity>
                    );
                  })()
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

              <TouchableOpacity onPress={handleCreate} disabled={loading} activeOpacity={0.85}>
                <LinearGradient
                  colors={[Brand.btnPrimaryGradientStart, Brand.accentOrange]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.createButton, loading ? { opacity: Brand.btnDisabledOpacity } : null]}
                >
                  {loading ? (
                    <ActivityIndicator color={Brand.btnPrimaryText} />
                  ) : (
                    <Text style={[styles.createButtonText, { color: Brand.btnPrimaryText }]}>Ustvari dogodek</Text>
                  )}
                </LinearGradient>
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
  chipSelected: {
    backgroundColor: Brand.secondaryGradientEnd,
    borderColor: Brand.secondaryGradientEnd,
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
  createButton: {
    height: 50,
    borderRadius: 16, // Pill shape (14-18px)
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    shadowColor: Brand.glowOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
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
});
