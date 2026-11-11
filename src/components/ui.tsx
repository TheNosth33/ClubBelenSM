import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  header,
  scroll = true,
  padded = true,
  edges = ['top'],
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={[padded && styles.padded, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded && styles.padded]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg = {
    primary: colors.primary,
    secondary: colors.primarySoft,
    danger: colors.danger,
    ghost: 'transparent',
    success: colors.success,
  }[variant];
  const fg = variant === 'secondary' || variant === 'ghost' ? colors.primary : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.primary,
  disabled,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.chip,
        { borderColor: selected ? color : colors.border, backgroundColor: selected ? color : colors.card },
        disabled && { opacity: 0.4 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.white : colors.textMuted} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, color = colors.primary, bg }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg ?? color + '1A' }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon = 'leaf-outline', text }: { icon?: IconName; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={32} color={colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ToggleRow({ label, value, onChange, description, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string; disabled?: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 15, color: colors.text }}>{label}</Text>
        {description ? <Text style={styles.hint}>{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.bg }]}>
      {icon ? (
        <View style={[styles.listIcon, danger && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.listTitle, danger && { color: colors.danger }]}>{title}</Text>
        {subtitle ? <Text style={styles.listSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && styles.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: 16 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionAction: { fontSize: 14, fontWeight: '600', color: colors.primary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 14, fontWeight: '600' },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 24, gap: 8 },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  listIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  listSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  segmented: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.card, ...shadow, shadowOpacity: 0.06 },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.primary },
});
