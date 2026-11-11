import React from 'react';
import { Image, ImageBackground, StyleProp, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Club } from '../data/types';
import { CLUB_INFO } from '../data/constants';
import { colors } from '../theme';

const CLUB_ICON = {
  aventureros: 'sunny',
  conquistadores: 'compass',
  guias: 'flag',
} as const;

export function ClubLogo({ club, size = 56 }: { club: Club; size?: number }) {
  if (club.logoUri) {
    return <Image source={{ uri: club.logoUri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: club.color,
      }}
    >
      <Ionicons name={CLUB_ICON[club.id]} size={size * 0.5} color={club.color} />
    </View>
  );
}

/** Portada: imagen elegida por el director, o un degradado con el color del club. */
export function Cover({
  uri,
  color = colors.primary,
  height = 140,
  children,
  style,
}: {
  uri?: string;
  color?: string;
  height?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (uri) {
    return (
      <ImageBackground source={{ uri }} style={[{ height, overflow: 'hidden' }, style]} resizeMode="cover">
        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']} style={{ flex: 1 }}>
          {children}
        </LinearGradient>
      </ImageBackground>
    );
  }
  return (
    <LinearGradient colors={[color, shade(color, -35)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ height, overflow: 'hidden' }, style]}>
      <Pattern />
      {children}
    </LinearGradient>
  );
}

function Pattern() {
  return (
    <View style={{ position: 'absolute', inset: 0 } as ViewStyle} pointerEvents="none">
      <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40 }} />
      <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -50, left: 30 }} />
    </View>
  );
}

export function clubColor(id: keyof typeof CLUB_INFO) {
  return CLUB_INFO[id].color;
}

/** Aclara (+) u oscurece (−) un color hex. */
export function shade(hex: string, percent: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * (percent < 0 ? c : 255 - c))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function ClubBadge({ club }: { club: Club }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: club.color + '1A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' }}>
      <Ionicons name={CLUB_ICON[club.id]} size={12} color={club.color} />
      <Text style={{ color: club.color, fontWeight: '700', fontSize: 12 }}>{club.name}</Text>
    </View>
  );
}
