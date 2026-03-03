import React, { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import * as Brand from "@/constants/Colors";
import { formatDateSL, formatTimeSL, lineupToMultiline, safeParseDate } from "@/utils/date";

type EventFeedCardProps = {
  id: string;
  title: string;
  posterUrl?: string | null;
  startsAt: string;
  lineup?: string | null;
  genre?: string | null;
  priceType?: string | null;
  price?: number | null;
  city?: string | null;
  badgeText?: string | null;
  onPress: (id: string) => void;
  rightMeta?: React.ReactNode;
};

function EventFeedCardComponent({
  id,
  title,
  posterUrl,
  startsAt,
  lineup,
  genre,
  priceType,
  price,
  city,
  badgeText,
  onPress,
  rightMeta,
}: EventFeedCardProps) {
  const parsed = safeParseDate(startsAt);
  const dateText = parsed ? formatDateSL(parsed) : "Neveljaven datum";
  const timeText = parsed ? formatTimeSL(parsed) : "--:--";
  const lineupText = lineupToMultiline(lineup);
  const priceText = priceType === "free" ? "Brezplačno" : `€${Number(price ?? 0).toFixed(2)}`;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(id)}
      activeOpacity={0.85}
    >
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.image} />
      ) : (
        <View style={styles.imageFallback}>
          <IconSymbol
            ios_icon_name="photo"
            android_material_icon_name="image"
            size={26}
            color={Brand.textSecondary}
          />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {badgeText ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <IconSymbol ios_icon_name="calendar" android_material_icon_name="event" size={16} color={Brand.secondaryGradientEnd} />
          <Text style={styles.metaText}>{dateText}</Text>
        </View>

        <View style={styles.metaRow}>
          <IconSymbol ios_icon_name="clock" android_material_icon_name="access-time" size={16} color={Brand.secondaryGradientEnd} />
          <Text style={styles.metaText}>{timeText}</Text>
        </View>

        <View style={styles.metaRowTop}>
          <IconSymbol ios_icon_name="music.note.list" android_material_icon_name="queue-music" size={16} color={Brand.secondaryGradientEnd} />
          <Text style={styles.multilineText}>{lineupText || "Lineup ni naveden"}</Text>
        </View>

        <View style={styles.metaRow}>
          <IconSymbol ios_icon_name="music.note" android_material_icon_name="music-note" size={16} color={Brand.secondaryGradientEnd} />
          <Text style={styles.metaText}>{genre || "other"}</Text>
        </View>

        <View style={styles.metaRow}>
          <IconSymbol ios_icon_name="ticket" android_material_icon_name="confirmation-number" size={16} color={Brand.secondaryGradientEnd} />
          <Text style={styles.metaText}>{priceText}</Text>
        </View>

        <View style={styles.metaRow}>
          <IconSymbol ios_icon_name="location" android_material_icon_name="location-on" size={16} color={Brand.highlightYellow} />
          <Text style={styles.cityText}>{city || "Neznano mesto"}</Text>
          {rightMeta}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const EventFeedCard = memo(EventFeedCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Brand.borderSubtle,
    backgroundColor: Brand.surfaceDark,
  },
  image: {
    width: "100%",
    height: 200,
  },
  imageFallback: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Brand.surfaceElevated,
  },
  content: {
    padding: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: Brand.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Brand.secondaryGradientEnd,
  },
  badgeText: {
    color: Brand.textPrimary,
    fontSize: 10,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaRowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: Brand.textSecondary,
  },
  multilineText: {
    flex: 1,
    fontSize: 14,
    color: Brand.textPrimary,
    lineHeight: 18,
  },
  cityText: {
    fontSize: 14,
    color: Brand.textPrimary,
    flexShrink: 1,
  },
});
