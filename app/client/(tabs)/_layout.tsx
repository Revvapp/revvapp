import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

const NAVY = '#1A3A5C';
const GOLD = '#C9A227';
const MUTED = '#A0AEC0';

function TabIcon({
  name,
  nameFocused,
  focused,
  badge,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  nameFocused: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
  badge?: number;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <View>
        <Ionicons name={focused ? nameFocused : name} size={23} color={focused ? NAVY : MUTED} />
        {!!badge && badge > 0 && (
          <View style={tabStyles.badge}>
            <Text style={tabStyles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D93025',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
});

export default function ClientTabsLayout() {
  const unreadMessages = useUnreadMessageCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EDF0F5',
          height: 72,
          paddingBottom: 0,
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home-outline" nameFocused="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="find"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="search-outline" nameFocused="search" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="calendar-outline" nameFocused="calendar" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chatbubble-outline" nameFocused="chatbubble" focused={focused} badge={unreadMessages} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-outline" nameFocused="person" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="garage" options={{ href: null }} />
    </Tabs>
  );
}
