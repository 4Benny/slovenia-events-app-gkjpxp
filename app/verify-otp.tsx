
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { supabase } from "@/app/integrations/supabase/client";
import * as Brand from "@/constants/Colors";

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { email, password } = useLocalSearchParams<{ email: string; password: string }>();
  
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  const emailDisplay = email || "";

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError({
        title: "Invalid OTP",
        message: "Please enter the 6-digit code sent to your email",
      });
      return;
    }

    if (!email || !password) {
      setError({
        title: "Error",
        message: "Missing email or password. Please try signing up again.",
      });
      return;
    }

    setLoading(true);

    try {
      console.log("[VerifyOTP] Verifying OTP for email:", email);
      
      // Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (verifyError) {
        throw verifyError;
      }

      console.log("[VerifyOTP] OTP verified successfully");

      // Wait for session to be established
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error("Session not established after OTP verification");
      }

      console.log("[VerifyOTP] Session established, navigating to onboarding");
      router.replace("/onboarding" as any);
    } catch (err: any) {
      console.error("[VerifyOTP] Error:", err);
      setError({
        title: "Verification Failed",
        message: err.message || "Invalid or expired code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email || !password) {
      setError({
        title: "Error",
        message: "Cannot resend code. Please try signing up again.",
      });
      return;
    }

    setLoading(true);

    try {
      console.log("[VerifyOTP] Resending verification code");
      
      // Trigger a new signup to resend the code
      await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://natively.dev/email-confirmed",
        },
      });

      setError({
        title: "Code Sent",
        message: "A new verification code has been sent to your email",
      });
    } catch (err: any) {
      console.error("[VerifyOTP] Resend error:", err);
      setError({
        title: "Resend Failed",
        message: err.message || "Failed to resend code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to
          </Text>
          <Text style={styles.email}>{emailDisplay}</Text>
          <Text style={styles.instruction}>
            Enter the code below to verify your email address
          </Text>

          <TextInput
            style={styles.otpInput}
            placeholder="000000"
            placeholderTextColor={Brand.textSecondary}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify Email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendCode}
            disabled={loading}
          >
            <Text style={styles.resendButtonText}>
              Didn&apos;t receive the code? Resend
            </Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    color: Brand.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: Brand.textSecondary,
    textAlign: "center",
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: Brand.secondaryGradientEnd,
    textAlign: "center",
    marginBottom: 16,
  },
  instruction: {
    fontSize: 14,
    color: Brand.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },
  otpInput: {
    height: 60,
    borderWidth: 2,
    borderColor: Brand.accentOrange,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 24,
    backgroundColor: Brand.inputBg,
    color: Brand.textPrimary,
  },
  verifyButton: {
    height: 50,
    backgroundColor: Brand.accentOrange,
    borderRadius: Brand.borderRadiusInput,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  verifyButtonText: {
    color: Brand.primaryGradientStart,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resendButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  resendButtonText: {
    color: Brand.secondaryGradientEnd,
    fontSize: 14,
  },
});
