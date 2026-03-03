import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ScrollView, Platform } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Brand from "@/constants/Colors";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  scroll?: boolean;
};

export function Screen({
  children,
  style,
  contentStyle,
  edges = ["top", "left", "right"],
  scroll = false,
}: Props) {
  return (
    <LinearGradient
      colors={[Brand.primaryGradientStart, Brand.primaryGradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.flex, style]}
    >
      <SafeAreaView style={styles.flex} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.webFrame}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.contentFill, contentStyle]}>
            <View style={styles.webFrame}>{children}</View>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  contentFill: {
    flex: 1,
  },
  webFrame: {
    flex: 1,
    width: "100%",
    ...(Platform.OS === "web"
      ? {
          maxWidth: 1100,
          alignSelf: "center",
          paddingHorizontal: 16,
        }
      : null),
  },
});
