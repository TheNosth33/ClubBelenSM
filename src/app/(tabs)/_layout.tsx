import React from 'react';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ColorValue } from 'react-native';
import { useData } from '../../data/DataContext';
import { tasksAssignedTo } from '../../data/selectors';
import { colors } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ active, inactive, color, focused, size }: { active: IconName; inactive: IconName; color: ColorValue; focused: boolean; size: number }) {
  return <Ionicons name={focused ? active : inactive} color={color as string} size={size} />;
}

function icon(active: IconName, inactive: IconName) {
  return function TabBarIcon(p: { color: ColorValue; focused: boolean; size: number }) {
    return <TabIcon active={active} inactive={inactive} {...p} />;
  };
}

export default function TabsLayout() {
  const { db, me } = useData();
  const pendingNew = me ? tasksAssignedTo(db, me.id).filter((t) => t.assignments[me.id].status === 'pendiente' && !t.assignments[me.id].seen).length : 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen
        name="tareas"
        options={{ title: 'Tareas', tabBarIcon: icon('checkbox', 'checkbox-outline'), tabBarBadge: pendingNew > 0 ? pendingNew : undefined }}
      />
      <Tabs.Screen name="calendario" options={{ title: 'Calendario', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="club" options={{ title: 'Mi Club', tabBarIcon: icon('people', 'people-outline') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
