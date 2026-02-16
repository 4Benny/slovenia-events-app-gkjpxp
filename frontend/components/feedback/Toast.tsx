
import React, { useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import * as Brand from "@/constants/Colors";

interface ToastProps {
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onHide: () => void;
}

export function Toast({
  visible,
  message,
  type = "info",
  duration = 3000,
  onHide,
}: ToastProps) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide();
      });
    }
  }, [visible, duration, onHide, opacity]);

  if (!visible) return null;

  const backgroundColor =
    type === "success"
      ? Brand.successGreen
      : type === "error"
      ? Brand.dangerRed
      : Brand.btnPrimaryGradientStart;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View style={[styles.container, { backgroundColor, opacity }]}>
        <Text style={styles.message}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  container: {
    maxWidth: 520,
    width: "90%",
    padding: 16,
    borderRadius: 12,
  },
  message: {
    color: Brand.textPrimary,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
});
