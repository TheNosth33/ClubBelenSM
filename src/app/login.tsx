import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useData } from '../data/DataContext';
import { ASSOCIATION_NAME, ORG_NAME } from '../data/constants';
import { DEMO_PASSWORD, INITIAL_ADMIN } from '../data/seed';
import { Sex } from '../data/types';
import { colors, radius } from '../theme';
import { Button, Chip, Field, Label } from '../components/ui';
import { DateField } from '../components/DateField';
import { PasswordStrength } from '../components/UserForm';
import { ageFromBirthDate } from '../utils/dates';
import { suggestUsername, validatePassword } from '../utils/users';

export default function Login() {
  const { login, mode, needsSetup } = useData();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const err = await login(username, password);
    setLoading(false);
    if (err) setError(err);
    else router.replace('/');
  };

  return (
    <LinearGradient colors={[colors.primary, colors.primaryDark]} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="star" size={44} color={colors.accent} />
          </View>
          <Text style={styles.title}>{ORG_NAME}</Text>
          <Text style={styles.subtitle}>{ASSOCIATION_NAME}</Text>

          {needsSetup ? (
            <SetupCard />
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Iniciar sesión</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Usuario"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Contraseña"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!show}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={submit}
                />
                <Pressable onPress={() => setShow(!show)} hitSlop={8}>
                  <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title="Entrar" onPress={submit} loading={loading} disabled={!username || !password} />
              <Text style={styles.help}>¿Olvidaste tu contraseña? Pide a tu director que la restablezca.</Text>
            </View>
          )}

          {mode === 'local' ? (
            <View style={styles.demo}>
              <Text style={styles.demoTitle}>Modo demostración</Text>
              <Text style={styles.demoText}>
                Director General: {INITIAL_ADMIN.username} / {INITIAL_ADMIN.password}
              </Text>
              <Text style={styles.demoText}>Miembro: sofia.gomez / {DEMO_PASSWORD}</Text>
              <Text style={styles.demoText}>Director Asociado: maria.hernandez / {DEMO_PASSWORD}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/** Primera vez con Supabase: crea la cuenta del Director General. */
function SetupCard() {
  const { setup } = useData();
  const [fullName, setFullName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const user = username ?? suggestUsername(fullName, []);
  const age = ageFromBirthDate(birthDate);

  const submit = async () => {
    setError(null);
    if (fullName.trim().split(/\s+/).length < 2) return setError('Escribe tu nombre y apellido.');
    if (!sex) return setError('Elige el sexo.');
    if (age === null || age < 16) return setError('Elige una fecha de nacimiento válida (16 años o más).');
    if (!/^[a-z0-9.]{3,}$/.test(user)) return setError('Usuario no válido: solo minúsculas, números y puntos.');
    const pwErr = validatePassword(password);
    if (pwErr) return setError(pwErr);
    if (password !== password2) return setError('Las contraseñas no coinciden.');
    setLoading(true);
    const err = await setup({ fullName: fullName.trim().replace(/\s+/g, ' '), sex, birthDate, username: user, password, clubs: ['guias'] });
    setLoading(false);
    if (err) setError(err);
    else router.replace('/');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Configuración inicial</Text>
      <Text style={styles.help}>Crea la cuenta del Director General. Solo se hace una vez; después él crea a los demás usuarios.</Text>
      <Field label="Nombre completo" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Label>Sexo</Label>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        <Chip label="Masculino" selected={sex === 'M'} onPress={() => setSex('M')} />
        <Chip label="Femenino" selected={sex === 'F'} onPress={() => setSex('F')} />
      </View>
      <DateField label="Fecha de nacimiento" value={birthDate} onChange={setBirthDate} maximumDate={new Date()} />
      <Field label="Usuario" value={user} onChangeText={(v) => setUsername(v.toLowerCase().replace(/\s/g, ''))} autoCapitalize="none" autoCorrect={false} />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
      <Field label="Confirmar contraseña" value={password2} onChangeText={setPassword2} secureTextEntry />
      <PasswordStrength pw={password} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Crear cuenta y entrar" onPress={submit} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 60 },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: colors.white, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, gap: 12 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.bg,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text },
  error: { color: colors.danger, fontSize: 14 },
  help: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  demo: { marginTop: 20, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)', gap: 2 },
  demoTitle: { color: colors.accent, fontWeight: '800', marginBottom: 4 },
  demoText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
});
