import * as Crypto from 'expo-crypto';
import { CLUB_INFO, CLUB_IDS, PASSWORD_MIN_LENGTH } from '../data/constants';
import { ClubId, User } from '../data/types';

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
}

/**
 * Genera el usuario a partir del nombre completo.
 * "Juan Carlos Pérez López" -> "juan.perez"; "Ana López" -> "ana.lopez".
 * Si ya existe, se agrega un número: "juan.perez2".
 */
export function suggestUsername(fullName: string, taken: string[]): string {
  const parts = normalize(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  let base: string;
  if (parts.length >= 4) base = `${parts[0]}.${parts[2]}`;
  else if (parts.length >= 2) base = `${parts[0]}.${parts[1]}`;
  else base = parts[0];
  const set = new Set(taken.map((t) => t.toLowerCase()));
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw) || !/\d/.test(pw)) return 'La contraseña debe combinar letras y números.';
  return null;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newSalt(): string {
  return toHex(Crypto.getRandomBytes(16));
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

export function clubForAge(age: number | null): ClubId | null {
  if (age === null) return null;
  for (const id of CLUB_IDS) {
    const info = CLUB_INFO[id];
    if (age >= info.minAge && (info.maxAge === null || age <= info.maxAge)) return id;
  }
  return null;
}

/**
 * Clubes que puede tener un usuario según su edad.
 * Menores de 16: solo el club de su edad. Desde 16 años (Guía Mayor) puede
 * además servir en otro club, hasta 2 clubes.
 */
export function allowedClubsForAge(age: number | null): ClubId[] {
  const own = clubForAge(age);
  if (!own) return [];
  if (own === 'guias') return CLUB_IDS;
  return [own];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const second = parts.length >= 3 ? parts[2][0] : parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

export function firstName(u: Pick<User, 'fullName'>): string {
  return u.fullName.split(/\s+/)[0] ?? u.fullName;
}

export function newId(): string {
  return Crypto.randomUUID();
}
