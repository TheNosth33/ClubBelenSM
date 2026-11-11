import React from 'react';
import { Image, Text, View } from 'react-native';
import { colors } from '../theme';
import { initials } from '../utils/users';

const PALETTE = ['#1B3A6B', '#1E5AA8', '#7A1F3D', '#E4572E', '#1E9E5A', '#6C4AB6', '#D99A00'];

export function Avatar({ name, uri, size = 44, ring }: { name: string; uri?: string; size?: number; ring?: boolean }) {
  const bg = PALETTE[Math.abs([...name].reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % PALETTE.length];
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: ring ? 3 : 0,
    borderColor: colors.white,
  };
  if (uri) return <Image source={{ uri }} style={[style, { backgroundColor: colors.border }]} />;
  return (
    <View style={[style, { backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}
