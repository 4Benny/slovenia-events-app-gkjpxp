import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Brand from "@/constants/Colors";
import { CONTENT_MAX_WIDTH, getResponsiveHorizontalPadding } from "@/utils/responsive";

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
  const { width: screenWidth } = useWindowDimensions();
  const paddingHorizontal = getResponsiveHorizontalPadding(screenWidth);

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
            contentContainerStyle={[
              styles.content,
              {
                paddingHorizontal,
                maxWidth: CONTENT_MAX_WIDTH,
                alignSelf: "center",
                width: "100%",
              },
              contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.content,
              styles.contentFill,
              {
                paddingHorizontal,
                maxWidth: CONTENT_MAX_WIDTH,
                alignSelf: "center",
                width: "100%",
              },
              contentStyle,
            ]}
          >
            {children}
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
  },
  contentFill: {
    flex: 1,
  },
});
