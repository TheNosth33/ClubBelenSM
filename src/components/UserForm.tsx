import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ALL_ROLES, CLUB_IDS, CLUB_INFO, MAX_CLUBS, MAX_ROLES, ROLE_LABELS, ROLES_DIRECTOR_CAN_ASSIGN } from '../data/constants';
import { isLeaderRole } from '../data/permissions';
import { ClubId, DB, Role, Sex, User } from '../data/types';
import { colors, radius } from '../theme';
import { ageFromBirthDate } from '../utils/dates';
import { allowedClubsForAge, clubForAge, suggestUsername, validatePassword } from '../utils/users';
import { DateField } from './DateField';
import { Button, Chip, Field, Label, styles as ui } from './ui';

export interface UserFormValues {
  fullName: string;
  sex: Sex | null;
  birthDate: string;
  phone: string;
  clubs: ClubId[];
  roles: Role[];
  username: string;
  password: string;
}

/**
 * Formulario de usuario. En modo "crear" incluye usuario y contraseña.
 * `manageableClubs`: clubes en los que quien edita puede asignar al usuario.
 */
export function UserForm({
  db,
  actor,
  initial,
  editing,
  manageableClubs,
  submitLabel,
  onSubmit,
}: {
  db: DB;
  actor: User;
  initial?: User;
  editing?: boolean;
  manageableClubs: ClubId[];
  submitLabel: string;
  onSubmit: (v: UserFormValues) => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [clubs, setClubs] = useState<ClubId[]>(initial?.clubs ?? []);
  const [roles, setRoles] = useState<Role[]>(initial?.roles ?? ['miembro']);
  const [username, setUsername] = useState(initial?.username ?? '');
  const [usernameEdited, setUsernameEdited] = useState(!!initial);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [tried, setTried] = useState(false);

  const age = ageFromBirthDate(birthDate);
  const ageClub = clubForAge(age);
  const byAge = allowedClubsForAge(age);
  const takenUsernames = useMemo(() => db.users.filter((u) => u.id !== initial?.id).map((u) => u.username), [db.users, initial?.id]);
  const autoUsername = suggestUsername(fullName, takenUsernames);
  const effectiveUsername = usernameEdited ? username : autoUsername;

  const roleOptions = actor.isGeneralDirector ? ALL_ROLES : ROLES_DIRECTOR_CAN_ASSIGN;
  // Roles de liderazgo que ya tiene el usuario y que quien edita no puede cambiar.
  const lockedRoles = actor.isGeneralDirector ? [] : roles.filter((r) => !roleOptions.includes(r));

  const onBirthDate = (v: string) => {
    setBirthDate(v);
    const a = ageFromBirthDate(v);
    const own = clubForAge(a);
    const allowed = allowedClubsForAge(a);
    const kept = clubs.filter((c) => allowed.includes(c));
    if (own && manageableClubs.includes(own) && !kept.includes(own) && kept.length < MAX_CLUBS) kept.unshift(own);
    setClubs(kept);
  };

  const toggleClub = (c: ClubId) => {
    if (clubs.includes(c)) setClubs(clubs.filter((x) => x !== c));
    else if (clubs.length < MAX_CLUBS) setClubs([...clubs, c]);
  };

  const toggleRole = (r: Role) => {
    if (roles.includes(r)) setRoles(roles.filter((x) => x !== r));
    else if (roles.length < MAX_ROLES) setRoles([...roles, r]);
  };

  const usernameTaken = takenUsernames.some((u) => u.toLowerCase() === effectiveUsername.toLowerCase());
  const errors = {
    fullName: fullName.trim().split(/\s+/).length < 2 ? 'Escribe nombre y apellido.' : null,
    sex: !sex ? 'Elige el sexo.' : null,
    birthDate: age === null ? 'Elige una fecha de nacimiento válida.' : age < CLUB_INFO.aventureros.minAge ? `La edad mínima es ${CLUB_INFO.aventureros.minAge} años.` : null,
    phone: phone && !/^[\d\s+-]{8,15}$/.test(phone) ? 'Número no válido (ej. 7777-7777).' : null,
    clubs: clubs.length === 0 ? 'Elige al menos un club.' : null,
    roles: roles.length === 0 ? 'Elige al menos un rol.' : null,
    username: !/^[a-z0-9.]{3,}$/.test(effectiveUsername) ? 'Usa solo minúsculas, números y puntos (mín. 3).' : usernameTaken ? 'Este usuario ya existe.' : null,
    password: editing ? null : validatePassword(password),
    password2: editing ? null : password !== password2 ? 'Las contraseñas no coinciden.' : null,
  };

  const submit = () => {
    setTried(true);
    if (Object.values(errors).some(Boolean) || !sex) return;
    onSubmit({ fullName: fullName.trim().replace(/\s+/g, ' '), sex, birthDate, phone: phone.trim(), clubs, roles, username: effectiveUsername, password });
  };

  const e = (k: keyof typeof errors) => (tried ? errors[k] : null);

  return (
    <View>
      <Field label="Nombre completo" value={fullName} onChangeText={setFullName} placeholder="Nombres y apellidos" error={e('fullName')} autoCapitalize="words" />

      <Label>Sexo</Label>
      <View style={styles.row}>
        <Chip label="Masculino" icon="male" selected={sex === 'M'} onPress={() => setSex('M')} />
        <Chip label="Femenino" icon="female" selected={sex === 'F'} onPress={() => setSex('F')} />
      </View>
      {e('sex') ? <Text style={ui.error}>{e('sex')}</Text> : null}
      <View style={{ height: 14 }} />

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <DateField label="Fecha de nacimiento" value={birthDate} onChange={onBirthDate} error={e('birthDate')} maximumDate={new Date()} />
        </View>
        <View style={styles.ageBox}>
          <Text style={ui.label}>Edad</Text>
          <Text style={styles.age}>{age ?? '—'}</Text>
        </View>
      </View>

      <Field label="Número de teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="7777-7777" error={e('phone')} />

      <Label>Club (según la edad)</Label>
      <View style={styles.row}>
        {CLUB_IDS.map((c) => {
          const allowedAge = byAge.includes(c);
          const manageable = manageableClubs.includes(c);
          const selected = clubs.includes(c);
          // Solo se pueden poner o quitar los clubes que quien edita administra.
          const disabled = !allowedAge || !manageable;
          return <Chip key={c} label={db.clubs[c].name} color={db.clubs[c].color} selected={selected} disabled={disabled} onPress={() => toggleClub(c)} />;
        })}
      </View>
      <Text style={ui.hint}>
        {age === null
          ? 'Primero elige la fecha de nacimiento.'
          : ageClub
            ? `${age} años → ${CLUB_INFO[ageClub].memberLabel}. Aventureros 4–9, Conquistadores 10–15, Guías Mayores 16+. ${ageClub === 'guias' ? 'Puede servir además en otro club (máx. 2).' : ''}`
            : 'Edad fuera de los rangos de los clubes.'}
      </Text>
      {e('clubs') ? <Text style={ui.error}>{e('clubs')}</Text> : null}
      <View style={{ height: 14 }} />

      <Label>Rol (hasta {MAX_ROLES})</Label>
      <View style={styles.row}>
        {ALL_ROLES.filter((r) => roleOptions.includes(r) || roles.includes(r)).map((r) => (
          <Chip
            key={r}
            label={ROLE_LABELS[r]}
            selected={roles.includes(r)}
            disabled={lockedRoles.includes(r) || (!roles.includes(r) && roles.length >= MAX_ROLES)}
            onPress={() => toggleRole(r)}
            color={isLeaderRole(r) ? colors.primaryDark : colors.primary}
          />
        ))}
      </View>
      {!actor.isGeneralDirector ? <Text style={ui.hint}>Los roles de Director y Director Asociado solo los asigna el Director General.</Text> : null}
      {e('roles') ? <Text style={ui.error}>{e('roles')}</Text> : null}
      <View style={{ height: 14 }} />

      <Field
        label="Usuario para entrar"
        value={effectiveUsername}
        onChangeText={(v) => {
          setUsernameEdited(true);
          setUsername(v.toLowerCase().replace(/\s/g, ''));
        }}
        autoCapitalize="none"
        autoCorrect={false}
        error={e('username')}
        hint={usernameEdited ? undefined : 'Se genera automáticamente con el nombre. Puedes cambiarlo.'}
      />

      {!editing ? (
        <>
          <View>
            <Field
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              error={e('password')}
              hint="Mínimo 8 caracteres, con letras y números."
            />
            <Pressable onPress={() => setShowPw(!showPw)} style={styles.eye} hitSlop={8}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <Field label="Confirmar contraseña" value={password2} onChangeText={setPassword2} secureTextEntry={!showPw} error={e('password2')} />
          <PasswordStrength pw={password} />
        </>
      ) : null}

      <Button title={submitLabel} icon="checkmark" onPress={submit} style={{ marginTop: 10 }} />
    </View>
  );
}

export function PasswordStrength({ pw }: { pw: string }) {
  const checks = [
    { ok: pw.length >= 8, label: '8 caracteres o más' },
    { ok: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw), label: 'Contiene letras' },
    { ok: /\d/.test(pw), label: 'Contiene números' },
  ];
  return (
    <View style={{ gap: 4, marginBottom: 6 }}>
      {checks.map((c) => (
        <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={c.ok ? colors.success : colors.textMuted} />
          <Text style={{ fontSize: 13, color: c.ok ? colors.success : colors.textMuted }}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ageBox: { width: 80, alignItems: 'center' },
  age: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    width: '100%',
    textAlign: 'center',
    paddingVertical: 10,
    overflow: 'hidden',
  },
  eye: { position: 'absolute', right: 14, top: 36 },
});
