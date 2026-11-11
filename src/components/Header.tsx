import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useData } from '../data/DataContext';
import { colors } from '../theme';

export function NotificationBell() {
  const { unreadCount } = useData();
  return (
    <Pressable onPress={() => router.push('/notificaciones')} hitSlop={10} style={styles.bell} accessibilityLabel="Notificaciones">
      <Ionicons name="notifications-outline" size={24} color={colors.text} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Encabezado de las pestañas: título a la izquierda y campana a la derecha. */
export function TabHeader({ title, subtitle, left, right }: { title?: string; subtitle?: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {left ?? (
          <>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {right}
        <NotificationBell />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: colors.bg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
});
