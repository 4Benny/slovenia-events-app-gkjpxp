
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Colors from '@/constants/Colors';
import { CONTENT_MAX_WIDTH } from '@/utils/responsive';

export interface TabBarItem {
  name: string;
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
}

export default function FloatingTabBar({ tabs }: FloatingTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const animatedValue = useSharedValue(0);

  const containerWidth = React.useMemo(() => {
    const desired = screenWidth - 32;
    const capped = Math.min(desired, CONTENT_MAX_WIDTH);
    return Math.max(280, capped);
  }, [screenWidth]);

  const layout = React.useMemo(() => {
    const outerWidth = containerWidth; // matches container width
    const innerWidth = outerWidth - 16; // accounts for indicator left/right inset (8 + 8)
    const tabWidth = innerWidth / Math.max(1, tabs.length);
    return { outerWidth, innerWidth, tabWidth };
  }, [containerWidth, tabs.length]);

  // Improved active tab detection
  const activeTabIndex = React.useMemo(() => {
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      const routePath = tab.route;
      let score = 0;

      if (pathname === routePath) {
        score = 100;
      } else if (pathname.startsWith(routePath)) {
        score = 80;
      } else if (pathname.includes(tab.name)) {
        score = 60;
      } else if (routePath.includes('/(tabs)/') && pathname.includes(routePath.split('/(tabs)/')[1])) {
        score = 40;
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    return bestMatch >= 0 ? bestMatch : 0;
  }, [pathname, tabs]);

  React.useEffect(() => {
    if (activeTabIndex >= 0) {
      animatedValue.value = withSpring(activeTabIndex, {
        damping: 20,
        stiffness: 120,
        mass: 1,
      });
    }
  }, [activeTabIndex, animatedValue]);

  const handleTabPress = (route: string) => {
    router.push(route as any);
  };

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: animatedValue.value * layout.tabWidth,
        },
      ],
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[styles.container, { width: containerWidth }]}
      >
        <BlurView intensity={20} style={styles.blurContainer}>
          {/* Glassmorphism background */}
          <View style={styles.glassBackground} />
          
          {/* Active tab indicator with gradient glow */}
          <Animated.View
            style={[
              styles.indicatorContainer,
              { width: layout.tabWidth },
              indicatorStyle,
            ]}
          >
            <LinearGradient
              colors={[Colors.navIconActiveGradientStart, Colors.navIconActiveGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.indicator}
            />
          </Animated.View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {tabs.map((tab, index) => {
              const isActive = activeTabIndex === index;

              return (
                <React.Fragment key={index}>
                  <TouchableOpacity
                    style={styles.tab}
                    onPress={() => handleTabPress(tab.route)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tabContent}>
                      <View style={styles.iconSlot}>
                        {isActive ? (
                          <LinearGradient
                            colors={[Colors.navIconActiveGradientStart, Colors.navIconActiveGradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.activeIconGradient}
                          >
                            <IconSymbol
                              android_material_icon_name={tab.icon}
                              size={28}
                              color={Colors.primaryGradientStart}
                            />
                          </LinearGradient>
                        ) : (
                          <View style={styles.inactiveIconContainer}>
                            <IconSymbol
                              android_material_icon_name={tab.icon}
                              size={28}
                              color={Colors.navIconInactive}
                            />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.tabLabel,
                          {
                            color: isActive ? Colors.accentOrange : Colors.navIconInactive,
                            fontWeight: isActive ? '700' : '500',
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  container: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  blurContainer: {
    borderRadius: Colors.borderRadiusPill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...Platform.select({
      ios: {
        backgroundColor: Colors.navBg,
      },
      android: {
        backgroundColor: Colors.navBg,
      },
      web: {
        backgroundColor: Colors.navBg,
      },
    }),
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.navBg,
  },
  indicatorContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    bottom: 8,
    zIndex: 1,
  },
  indicator: {
    flex: 1,
    borderRadius: Colors.borderRadiusPill,
    opacity: 0.15,
    shadowColor: Colors.accentOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    zIndex: 10,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    zIndex: 10,
  },
  activeIconGradient: {
    borderRadius: 50,
    padding: 4,
    shadowColor: Colors.glowOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconSlot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveIconContainer: {
    borderRadius: 50,
    padding: 4,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
