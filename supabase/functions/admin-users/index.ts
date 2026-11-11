// Edge Function "admin-users": operaciones que necesitan la clave de
// servicio de Supabase y por eso no pueden hacerse desde la app.
//
//   bootstrap       crea la cuenta del Director General (solo la primera vez)
//   create          crea un usuario (Director General, Directores, y
//                   Directores Asociados con permiso — estos quedan pendientes)
//   reset_password  cambia la contraseña de otro usuario
//   delete          elimina un usuario (solo Director General)
//
// Los permisos se validan con funciones SQL del esquema.
// Despliegue: npx supabase functions deploy admin-users --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_DOMAIN = Deno.env.get('LOGIN_EMAIL_DOMAIN') ?? 'usuarios.clubbelensm.app';
const CLUBS = ['aventureros', 'conquistadores', 'guias'];
const ROLES = ['miembro', 'director', 'director_asociado', 'consejero', 'instructor', 'secretario', 'tesorero', 'capellan'];

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface NewUser {
  fullName: string;
  username: string;
  sex: 'M' | 'F';
  birthDate: string;
  phone?: string;
  clubs: string[];
  roles: string[];
}

function reply(body: Record<string, unknown>) {
  // Siempre 200: la app lee { error } o { result } del cuerpo.
  return new Response(JSON.stringify(body), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw) || !/\d/.test(pw)) return 'La contraseña debe combinar letras y números.';
  return null;
}

function ageFrom(birth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [y, m, d] = birth.split('-').map(Number);
  const b = new Date(y, m - 1, d);
  const t = new Date();
  if (isNaN(b.getTime()) || b > t) return null;
  let age = t.getFullYear() - y;
  if (t.getMonth() < m - 1 || (t.getMonth() === m - 1 && t.getDate() < d)) age--;
  return age;
}

// Mismas reglas que src/utils/users.ts (allowedClubsForAge)
function allowedClubs(age: number): string[] {
  if (age >= 16) return CLUBS;
  if (age >= 10) return ['conquistadores'];
  if (age >= 4) return ['aventureros'];
  return [];
}

function validateUser(u: NewUser, isFirstAdmin = false): string | null {
  if (!u || typeof u !== 'object') return 'Datos incompletos.';
  if (typeof u.fullName !== 'string' || u.fullName.trim().split(/\s+/).length < 2) return 'Escribe nombre y apellido.';
  if (typeof u.username !== 'string' || !/^[a-z0-9.]{3,40}$/.test(u.username)) return 'Usuario no válido.';
  if (u.sex !== 'M' && u.sex !== 'F') return 'Elige el sexo.';
  const age = ageFrom(u.birthDate);
  if (age === null) return 'Fecha de nacimiento no válida.';
  if (!Array.isArray(u.clubs) || u.clubs.length > 2 || u.clubs.some((c) => !CLUBS.includes(c))) return 'Clubes no válidos.';
  if (!isFirstAdmin) {
    if (u.clubs.length === 0) return 'Elige al menos un club.';
    if (u.clubs.some((c) => !allowedClubs(age).includes(c))) return 'El club no corresponde a la edad.';
    if (!Array.isArray(u.roles) || u.roles.length < 1 || u.roles.length > 3 || u.roles.some((r) => !ROLES.includes(r))) {
      return 'Roles no válidos.';
    }
  }
  return null;
}

async function usernameTaken(username: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle();
  return !!data;
}

async function createAuthUser(password: string, username: string): Promise<{ id?: string; error?: string }> {
  const email = `x${crypto.randomUUID().replaceAll('-', '')}@${EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) return { error: error?.message ?? 'No se pudo crear la cuenta.' };
  return { id: data.user.id };
}

async function callerId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Método no permitido.' });

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'Solicitud no válida.' });
  }

  try {
    // ---------- Primera vez: cuenta del Director General ----------
    if (body.action === 'bootstrap') {
      const { data: needs } = await admin.rpc('needs_setup');
      if (!needs) return reply({ error: 'La aplicación ya fue configurada.' });
      const user = body.user as NewUser;
      const err = validateUser(user, true) ?? validatePassword(body.password);
      if (err) return reply({ error: err });
      const created = await createAuthUser(body.password, user.username);
      if (!created.id) return reply({ error: created.error });
      const { data: ok, error } = await admin.rpc('bootstrap_profile', { p_id: created.id, p_data: user });
      if (error || !ok) {
        await admin.auth.admin.deleteUser(created.id);
        return reply({ error: 'La aplicación ya fue configurada.' });
      }
      return reply({ result: 'done' });
    }

    // ---------- Las demás acciones requieren sesión ----------
    const actor = await callerId(req);
    if (!actor) return reply({ error: 'Inicia sesión de nuevo.' });

    if (body.action === 'create') {
      const user = body.user as NewUser;
      const err = validateUser(user) ?? validatePassword(body.password);
      if (err) return reply({ error: err });
      const { data: decision, error: checkError } = await admin.rpc('check_create_user', {
        p_actor: actor,
        p_clubs: user.clubs,
        p_roles: user.roles,
      });
      if (checkError) throw checkError;
      if (decision === 'denied') return reply({ error: 'No tienes permiso para crear este usuario.', result: 'denied' });
      if (await usernameTaken(user.username)) return reply({ error: 'Este usuario ya existe.' });

      const created = await createAuthUser(body.password, user.username);
      if (!created.id) return reply({ error: created.error });
      const { error } = await admin.rpc('create_profile', {
        p_id: created.id,
        p_actor: actor,
        p_data: { ...user, fullName: user.fullName.trim().replace(/\s+/g, ' ') },
        p_pending: decision === 'pending',
        p_summary: String(body.summary ?? `Crear usuario ${user.fullName}`),
      });
      if (error) {
        await admin.auth.admin.deleteUser(created.id);
        return reply({ error: error.code === '23505' ? 'Este usuario ya existe.' : 'No se pudo guardar el usuario.' });
      }
      return reply({ result: decision === 'pending' ? 'pending' : 'done' });
    }

    if (body.action === 'reset_password') {
      const err = validatePassword(body.password);
      if (err) return reply({ error: err });
      const { data: allowed } = await admin.rpc('check_reset_password', { p_actor: actor, p_target: body.userId });
      if (!allowed) return reply({ error: 'No tienes permiso para cambiar esta contraseña.', result: 'denied' });
      const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
      if (error) throw error;
      return reply({ result: 'done' });
    }

    if (body.action === 'delete') {
      const { data: isDG } = await admin.rpc('is_general_director', { p_uid: actor });
      if (!isDG || body.userId === actor) return reply({ error: 'Solo el Director General puede eliminar usuarios.', result: 'denied' });
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) throw error;
      return reply({ result: 'done' });
    }

    return reply({ error: 'Acción desconocida.' });
  } catch (e) {
    console.error(e);
    return reply({ error: 'Error del servidor. Intenta de nuevo.' });
  }
});
