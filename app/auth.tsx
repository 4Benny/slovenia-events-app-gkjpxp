
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";
import { IconSymbol } from "@/components/IconSymbol";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Brand from "@/constants/Colors";

type Mode = "signin" | "signup";

const ALLOWED_EMAIL_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
];

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"Moški" | "Ženska" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const validateEmailDomain = (emailAddress: string): boolean => {
    const emailLower = emailAddress.toLowerCase().trim();
    const domain = emailLower.split("@")[1];
    return ALLOWED_EMAIL_DOMAINS.includes(domain);
  };

  const handleEmailAuth = async () => {
    const input = emailOrUsername.trim();
    
    if (!input || !password) {
      setError({
        title: "Napaka pri validaciji",
        message: "Prosimo vnesite e-pošto/uporabniško ime in geslo",
      });
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        console.log("[Auth] Prijavljanje z:", input);
        
        let email = input;
        
        // If input doesn't contain @, treat it as username and look up email
        if (!input.includes("@")) {
          console.log("[Auth] Vnos je uporabniško ime, iskanje e-pošte v profilih");
          
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .eq("username", input.toLowerCase())
            .single();

          if (profileError || !profile || !profile.email) {
            throw new Error("Uporabniško ime ni najdeno");
          }

          email = profile.email;
          console.log("[Auth] E-pošta najdena za uporabniško ime");
        }
        
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        if (!data.user?.email_confirmed_at) {
          console.log("[Auth] E-pošta ni potrjena, preusmeritev na OTP zaslon");
          router.replace({
            pathname: "/verify-otp",
            params: { email, password },
          } as any);
          return;
        }

        console.log("[Auth] Prijava uspešna, preverjanje profila");
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          console.log("[Auth] Profil ni najden, preusmeritev na uvajanje");
          router.replace("/onboarding" as any);
        } else {
          console.log("[Auth] Profil obstaja, preusmeritev na dogodke");
          router.replace("/(tabs)/(home)/" as any);
        }
      } else {
        if (!input.includes("@")) {
          setError({
            title: "Napaka pri validaciji",
            message: "Prosimo vnesite veljaven e-poštni naslov za registracijo",
          });
          return;
        }

        if (!validateEmailDomain(input)) {
          setError({
            title: "Neveljavna domena e-pošte",
            message: `Prosimo uporabite e-pošto enega od teh ponudnikov: ${ALLOWED_EMAIL_DOMAINS.join(", ")}`,
          });
          return;
        }

        if (password.length < 8) {
          setError({
            title: "Šibko geslo",
            message: "Geslo mora biti dolgo vsaj 8 znakov",
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

        // Check if email already exists
        const { data: existingProfile, error: checkError } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", input.toLowerCase())
          .maybeSingle();

        if (existingProfile) {
          setError({
            title: "E-pošta že obstaja",
            message: "Ta e-poštni naslov je že registriran. Prosimo prijavite se ali uporabite drug e-poštni naslov.",
          });
          return;
        }

        console.log("[Auth] Registracija z e-pošto:", input);
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: input,
          password,
          options: {
            emailRedirectTo: "https://natively.dev/email-confirmed",
            data: {
              ...(ageNum ? { age: ageNum } : {}),
              ...(gender ? { gender } : {}),
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        console.log("[Auth] Registracija uspešna, preusmeritev na OTP potrditev");
        router.replace({
          pathname: "/verify-otp",
          params: { email: input, password, age: age },
        } as any);
      }
    } catch (err: any) {
      console.error("[Auth] Avtentikacija ni uspela:", err);
      setError({
        title: "Avtentikacija ni uspela",
        message: err.message || "Med avtentikacijo je prišlo do napake",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToFeed = () => {
    console.log("[Auth] Anonymous user navigating back to feed");
    router.replace("/(tabs)/(home)/" as any);
  };

  const modeTitle = mode === "signin" ? "Prijava" : "Registracija";
  const modeButtonText = mode === "signin" ? "Prijavi se" : "Registriraj se";
  const switchModeText = mode === "signin"
    ? "Nimate računa? Registrirajte se"
    : "Že imate račun? Prijavite se";
  const inputPlaceholder = mode === "signin" ? "E-pošta ali uporabniško ime" : "E-pošta";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.content}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleBackToFeed} style={styles.backButton}>
                <IconSymbol
                  ios_icon_name="arrow.left"
                  android_material_icon_name="arrow-back"
                  size={24}
                  color={Brand.accentOrange}
                />
              </TouchableOpacity>
              <Text style={styles.title}>{modeTitle}</Text>
              <View style={styles.placeholder} />
            </View>

            <TextInput
              style={styles.input}
              placeholder={inputPlaceholder}
              placeholderTextColor={Brand.textSecondary}
              value={emailOrUsername}
              onChangeText={setEmailOrUsername}
              keyboardType={mode === "signin" ? "default" : "email-address"}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Geslo"
              placeholderTextColor={Brand.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {mode === "signup" && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Starost (npr. 18)"
                  placeholderTextColor={Brand.textSecondary}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />
                <View style={styles.genderRow}>
                  <TouchableOpacity
                    style={[styles.genderChip, gender === "Moški" && styles.genderChipSelected]}
                    onPress={() => setGender("Moški")}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.genderChipText, gender === "Moški" && styles.genderChipTextSelected]}>
                      Moški
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genderChip, gender === "Ženska" && styles.genderChipSelected]}
                    onPress={() => setGender("Ženska")}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.genderChipText, gender === "Ženska" && styles.genderChipTextSelected]}>
                      Ženska
                    </Text>
                  </TouchableOpacity>
                  {!!gender && (
                    <TouchableOpacity
                      style={styles.genderClear}
                      onPress={() => setGender("")}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.genderClearText}>Počisti</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.hint}>
                  Dovoljene domene: {ALLOWED_EMAIL_DOMAINS.join(", ")}
                </Text>
              </>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{modeButtonText}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchModeButton}
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              <Text style={styles.switchModeText}>{switchModeText}</Text>
            </TouchableOpacity>
            </Animated.View>
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
    </>
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
    padding: 24,
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: Brand.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    borderRadius: Brand.borderRadiusInput,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: Brand.inputBg,
    color: Brand.textPrimary,
  },
  hint: {
    fontSize: 12,
    color: Brand.textSecondary,
    marginTop: -8,
    marginBottom: 16,
  },
  genderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: -4,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  genderChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    backgroundColor: Brand.surfaceDark,
  },
  genderChipSelected: {
    borderColor: Brand.accentOrange,
    backgroundColor: Brand.secondaryGradientEnd,
  },
  genderChipText: {
    color: Brand.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  genderChipTextSelected: {
    color: Brand.primaryGradientStart,
  },
  genderClear: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    backgroundColor: "transparent",
  },
  genderClearText: {
    color: Brand.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  primaryButton: {
    height: 50,
    backgroundColor: Brand.accentOrange,
    borderRadius: Brand.borderRadiusInput,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: Brand.primaryGradientStart,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchModeText: {
    color: Brand.secondaryGradientEnd,
    fontSize: 14,
  },
});
