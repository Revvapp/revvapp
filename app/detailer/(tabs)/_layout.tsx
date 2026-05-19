import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

const NAVY = '#1A3A5C';
const GOLD = '#C9A227';
const MUTED = '#A0AEC0';

function TabIcon({
  name,
  nameFocused,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  nameFocused: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <Ionicons name={focused ? nameFocused : name} size={23} color={focused ? NAVY : MUTED} />
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
      )}
    </View>
  );
}

export default function DetailerTabsLayout() {
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
            <TabIcon name="grid-outline" nameFocused="grid" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="briefcase-outline" nameFocused="briefcase" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="people-outline" nameFocused="people" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="cash-outline" nameFocused="cash" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reach"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="megaphone-outline" nameFocused="megaphone" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
