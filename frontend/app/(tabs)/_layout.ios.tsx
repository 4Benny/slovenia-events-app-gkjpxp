
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, userRole, loading: authLoading } = useAuth();
  const [tabs, setTabs] = useState<TabBarItem[]>([]);

  // Update tabs whenever userRole changes
  useEffect(() => {
    console.log("[Tab Layout iOS] User role changed:", userRole);
    console.log("[Tab Layout iOS] Auth loading:", authLoading);
    console.log("[Tab Layout iOS] User:", user?.id);

    const baseTabs: TabBarItem[] = [
      {
        name: '(home)',
        route: '/(tabs)/(home)/',
        icon: 'event',
        label: 'Dogodki',
      },
      {
        name: 'past-events',
        route: '/(tabs)/past-events',
        icon: 'history',
        label: 'Pretekli',
      },
      {
        name: 'profile',
        route: '/(tabs)/profile',
        icon: 'person',
        label: 'Profil',
      },
    ];

    // Show "Moji dogodki" tab for organizer and admin only
    const isOrganizerOrAdmin = userRole === 'organizer' || userRole === 'admin';
    
    console.log("[Tab Layout iOS] Is organizer or admin:", isOrganizerOrAdmin);
    
    if (isOrganizerOrAdmin) {
      console.log("[Tab Layout iOS] Adding organizer tab");
      baseTabs.splice(1, 0, {
        name: 'organizer',
        route: '/(tabs)/organizer',
        icon: 'business',
        label: 'Moji',
      });
    }

    console.log("[Tab Layout iOS] Final tabs:", baseTabs.map(t => t.label).join(', '));
    setTabs(baseTabs);
  }, [userRole, authLoading, user]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 250,
        }}
      >
        <Stack.Screen key="home" name="(home)" />
        <Stack.Screen key="past-events" name="past-events" />
        <Stack.Screen key="profile" name="profile" />
        <Stack.Screen key="organizer" name="organizer" />
      </Stack>
      {tabs.length > 0 && <FloatingTabBar tabs={tabs} />}
    </>
  );
}
