/**
 * Loading Button Component Template
 *
 * A button that shows a loading indicator when processing.
 * Commonly used for API calls, form submissions, etc.
 *
 * Features:
 * - Shows loading spinner when loading=true
 * - Disables interaction when loading
 * - Customizable styles
 * - Works with Pressable for better touch feedback
 *
 * Usage:
 * ```tsx
 * <LoadingButton
 *   loading={isSubmitting}
 *   onPress={handleSubmit}
 *   title="Submit"
 * />
 * ```
 */

import React from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Brand from "@/constants/Colors";

interface LoadingButtonProps {
  onPress: () => void;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
  style?: ViewStyle;
  textStyle?: TextStyle;
  loadingColor?: string;
}

export function LoadingButton({
  onPress,
  title,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
  loadingColor,
}: LoadingButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            loadingColor ||
            (variant === "outline"
              ? Brand.accentOrange
              : variant === "primary"
                ? Brand.primaryGradientStart
                : Brand.textPrimary)
          }
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`${variant}Text` as keyof typeof styles],
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: Brand.accentOrange,
  },
  secondary: {
    backgroundColor: Brand.secondaryGradientEnd,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Brand.accentOrange,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryText: {
    color: Brand.primaryGradientStart,
  },
  secondaryText: {
    color: Brand.textPrimary,
  },
  outlineText: {
    color: Brand.accentOrange,
  },
});
