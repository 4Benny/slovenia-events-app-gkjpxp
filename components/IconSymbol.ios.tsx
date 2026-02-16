import { StyleProp, ViewStyle } from "react-native";
import { SymbolView, SymbolViewProps, SymbolWeight } from "expo-symbols";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

/**
 * iOS implementation:
 * - Prefer SF Symbols when we have a valid/known symbol name.
 * - Otherwise fall back to MaterialIcons (prevents invisible icons when callers pass Material icon names on iOS).
 */
const MATERIAL_TO_SF: Partial<Record<keyof typeof MaterialIcons.glyphMap, SymbolViewProps["name"]>> = {
  // Tabs
  event: "calendar",
  history: "clock.arrow.circlepath",
  business: "building.2",
  person: "person",

  // Common
  "access-time": "clock",
  "arrow-back": "chevron.left",
  delete: "trash",
  edit: "pencil",
  settings: "gear",
  photo: "photo",
  send: "paperplane.fill",
  add: "plus",
  "confirmation-number": "ticket",
  people: "person.2.fill",
  "location-on": "location.fill",
};

export function IconSymbol({
  ios_icon_name,
  android_material_icon_name,
  size = 24,
  color,
  style,
  weight = "regular",
  onPress,
  onClick,
  onMouseOver,
  onMouseLeave,
  testID,
  accessibilityLabel,
}: {
  ios_icon_name?: SymbolViewProps["name"];
  android_material_icon_name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color: string;
  style?: any;
  weight?: SymbolWeight;
  onPress?: any;
  onClick?: any;
  onMouseOver?: any;
  onMouseLeave?: any;
  testID?: any;
  accessibilityLabel?: any;
}) {
  // If callers pass Material icon names into `ios_icon_name`, remap to an SF Symbol if we know one.
  const sfName =
    (ios_icon_name && typeof ios_icon_name === "string" && ios_icon_name.includes("-")
      ? MATERIAL_TO_SF[ios_icon_name as keyof typeof MaterialIcons.glyphMap]
      : ios_icon_name) ?? MATERIAL_TO_SF[android_material_icon_name];

  if (sfName) {
    return (
      <SymbolView
        name={sfName}
        weight={weight}
        tintColor={color}
        resizeMode="scaleAspectFit"
        style={[{ width: size, height: size }, style]}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  // Guaranteed fallback (prevents missing icons on iOS when there is no SF match).
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
