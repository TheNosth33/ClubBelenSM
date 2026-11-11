import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../data/DataContext';
import { Button, EmptyState, Screen } from '../components/ui';
import { colors, radius } from '../theme';
import { timeAgo } from '../utils/dates';

export default function Notifications() {
  const { myNotifications, markNotificationRead, markAllNotificationsRead, unreadCount } = useData();
  return (
    <Screen edges={['bottom']}>
      {unreadCount > 0 ? (
        <Button title="Marcar todas como leídas" variant="ghost" small icon="checkmark-done" onPress={markAllNotificationsRead} style={{ alignSelf: 'flex-end', marginVertical: 10 }} />
      ) : (
        <View style={{ height: 10 }} />
      )}
      {myNotifications.length === 0 ? (
        <EmptyState icon="notifications-off-outline" text="No tienes notificaciones." />
      ) : (
        myNotifications.map((n) => (
          <Pressable
            key={n.id}
            style={[styles.item, !n.read && styles.unread]}
            onPress={() => {
              markNotificationRead(n.id);
              if (n.href) {
                router.back();
                setTimeout(() => router.push(n.href as never), 50);
              }
            }}
          >
            <View style={[styles.icon, !n.read && { backgroundColor: colors.primary }]}>
              <Ionicons name="notifications" size={16} color={n.read ? colors.textMuted : colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, !n.read && { fontWeight: '800' }]}>{n.title}</Text>
              <Text style={styles.body}>{n.body}</Text>
              <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
            </View>
            {!n.read ? <View style={styles.dot} /> : null}
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12, padding: 14, backgroundColor: colors.card, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  unread: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  body: { fontSize: 14, color: colors.text, marginTop: 2 },
  time: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, alignSelf: 'center' },
});
