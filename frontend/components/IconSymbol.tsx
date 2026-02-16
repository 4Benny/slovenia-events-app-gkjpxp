// This file is a fallback for using MaterialIcons on Android and web.
// (iOS uses IconSymbol.ios.tsx)

import { StyleProp } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { OpaqueColorValue } from "react-native";

export function IconSymbol({
  // accepted for cross-platform call sites; ignored on Android/web
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name?: unknown;
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color: string | OpaqueColorValue;
  style?: any;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  return (
    <MaterialIcons
      name={android_material_icon_name}
      size={size}
      color={color}
      style={style}
      onPress={onPress}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
