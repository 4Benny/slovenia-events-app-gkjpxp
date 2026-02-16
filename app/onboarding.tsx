
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Brand from "@/constants/Colors";
import { CITY_FALLBACK_COORDS, normalizeCityKey } from "@/utils/geo";
import { CONTENT_MAX_WIDTH, getResponsiveHorizontalPadding } from "@/utils/responsive";

const LOCATION_STORAGE_KEY = "eventfinder_user_location";

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

// CITY_FALLBACK_COORDS moved to utils/geo.ts

export default function OnboardingScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const paddingHorizontal = getResponsiveHorizontalPadding(screenWidth);
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const formatRegionLabel = (value: string) =>
    value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;

  useEffect(() => {
    const requestLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;

          await AsyncStorage.setItem(
            LOCATION_STORAGE_KEY,
            JSON.stringify({ lat, lng })
          );

          const reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          if (reverseGeocode.length > 0) {
            const location = reverseGeocode[0];
            const mappedRegion = mapToSlovenianRegion(location.region);
            if (mappedRegion) {
              setRegion(mappedRegion);
            }
            if (location.city) {
              setCity(location.city);
            }
          }
        }
      } catch (err) {
        console.error("[Onboarding] Error requesting location:", err);
      }
    };

    requestLocation();
  }, []);

  const mapToSlovenianRegion = (regionName: string | null): string | null => {
    if (!regionName) return null;
    const normalized = regionName.toLowerCase();
    const found = SLOVENIAN_REGIONS.find(r => normalized.includes(r) || r.includes(normalized));
    return found || null;
  };

  const handleComplete = async () => {
    if (!username || username.length < 3) {
      setError({
        title: "Napaka pri validaciji",
        message: "Uporabniško ime mora biti dolgo vsaj 3 znake",
      });
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(username)) {
      setError({
        title: "Napaka pri validaciji",
        message: "Uporabniško ime lahko vsebuje samo male črke, številke, podčrtaje in pomišljaje",
      });
      return;
    }

    const trimmedAge = age.trim();
    const ageNum = trimmedAge ? parseInt(trimmedAge, 10) : null;
    if (trimmedAge && (ageNum === null || Number.isNaN(ageNum) || ageNum <= 0 || ageNum > 120)) {
      setError({
        title: "Neveljavna starost",
        message: "Prosimo vnesite veljavno starost",
      });
      return;
    }

    if (!region) {
      setError({
        title: "Napaka pri validaciji",
        message: "Prosimo izberite regijo",
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Ni prijavljenega uporabnika");
      }

      // Check if username already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        setError({
          title: "Uporabniško ime že obstaja",
          message: "To uporabniško ime je že zasedeno. Prosimo izberite drugo.",
        });
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          username: username.toLowerCase(),
          email: user.email || null,
          ...(ageNum ? { age: ageNum } : {}),
          region: region || null,
          city: city || null,
          role: "user",
          show_location: true,
        });

      if (insertError) {
        throw insertError;
      }

      // Store city location if provided
      const cityKey = normalizeCityKey(city);
      if (cityKey && CITY_FALLBACK_COORDS[cityKey]) {
        const coords = CITY_FALLBACK_COORDS[cityKey];
        await AsyncStorage.setItem(
          LOCATION_STORAGE_KEY,
          JSON.stringify(coords)
        );
      }

      router.replace("/(tabs)/(home)/" as any);
    } catch (err: any) {
      console.error("[Onboarding] Error:", err);
      setError({
        title: "Napaka pri ustvarjanju profila",
        message: err.message || "Profila ni bilo mogoče ustvariti",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View
            style={[
              styles.content,
              {
                paddingHorizontal,
                maxWidth: CONTENT_MAX_WIDTH,
                alignSelf: "center",
                width: "100%",
              },
            ]}
          >
            <Text style={styles.title}>Dobrodošli!</Text>
            <Text style={styles.subtitle}>Nastavite svoj profil</Text>

            <Text style={styles.label}>Uporabniško ime</Text>
            <TextInput
              style={styles.input}
              placeholder="JanezN5"
              placeholderTextColor={Brand.textSecondary}
              value={username}
              onChangeText={(text) => setUsername(text.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Samo male črke, številke, podčrtaji in pomišljaji
            </Text>

            <Text style={styles.label}>Starost</Text>
            <TextInput
              style={styles.input}
              placeholder="npr. 18"
              placeholderTextColor={Brand.textSecondary}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Regija</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {SLOVENIAN_REGIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.chip,
                    region === r && styles.chipSelected,
                  ]}
                  onPress={() => setRegion(r)}
                >
                  <Text style={[styles.chipText, region === r && styles.chipTextSelected]}>
                    {formatRegionLabel(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Mesto</Text>
            <TextInput
              style={styles.input}
              placeholder="Ljubljana"
              placeholderTextColor={Brand.textSecondary}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />

            <TouchableOpacity
              style={[styles.completeButton, loading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.completeButtonText}>Dokončaj</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.primaryGradientStart,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: Brand.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: "center",
    color: Brand.textSecondary,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: Brand.textPrimary,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    borderRadius: Brand.borderRadiusInput,
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 16,
    backgroundColor: Brand.inputBg,
    color: Brand.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginBottom: 16,
  },
  chipScroll: {
    maxHeight: 50,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    marginRight: 8,
    backgroundColor: Brand.surfaceDark,
  },
  chipSelected: {
    backgroundColor: Brand.secondaryGradientEnd,
    borderColor: Brand.secondaryGradientEnd,
  },
  chipText: {
    fontSize: 14,
    color: Brand.textPrimary,
  },
  chipTextSelected: {
    color: Brand.textPrimary,
    fontWeight: "600",
  },
  completeButton: {
    height: 50,
    backgroundColor: Brand.accentOrange,
    borderRadius: Brand.borderRadiusInput,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  completeButtonText: {
    color: Brand.primaryGradientStart,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
