import { CLUB_IDS, CLUB_INFO } from './constants';
import { Achievement, Activity, Assignment, ClubId, DB, Meeting, Notice, Role, Sex, Task, User } from './types';
import { addDays, nowISO, startOfWeek, toISO } from '../utils/dates';
import { hashPassword, newId, newSalt } from '../utils/users';

export const DB_VERSION = 1;

// Credenciales iniciales. Cámbialas al entrar por primera vez (Perfil > Cambiar contraseña).
export const INITIAL_ADMIN = { username: 'director.general', password: 'Belen2026' };
export const DEMO_PASSWORD = 'Club2026';

function emptyClubs(): DB['clubs'] {
  const clubs = {} as DB['clubs'];
  for (const id of CLUB_IDS) {
    clubs[id] = { id, name: CLUB_INFO[id].name, motto: CLUB_INFO[id].motto, color: CLUB_INFO[id].color };
  }
  return clubs;
}

async function makeUser(
  fullName: string,
  username: string,
  password: string,
  sex: Sex,
  birthDate: string,
  clubs: ClubId[],
  roles: Role[],
  extra: Partial<User> = {},
): Promise<User> {
  const salt = newSalt();
  return {
    id: newId(),
    fullName,
    username,
    salt,
    passwordHash: await hashPassword(password, salt),
    sex,
    birthDate,
    phone: '',
    clubs,
    roles,
    extraPermissions: [],
    revokedPermissions: [],
    active: true,
    createdAt: nowISO(),
    ...extra,
  };
}

/** Base de datos limpia: solo el Director General. */
export async function createEmptyDB(): Promise<DB> {
  const admin = await makeUser('Director General', INITIAL_ADMIN.username, INITIAL_ADMIN.password, 'M', '1985-01-01', ['guias', 'conquistadores'], ['director'], {
    isGeneralDirector: true,
  });
  return {
    version: DB_VERSION,
    users: [admin],
    clubs: emptyClubs(),
    activities: [],
    notices: [],
    tasks: [],
    notifications: [],
    meetings: [],
    achievements: [],
    pending: [],
  };
}

// Generador pseudoaleatorio determinista para que la demo siempre sea igual.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Base de datos con información de ejemplo para conocer la app. */
export async function createDemoDB(): Promise<DB> {
  const db = await createEmptyDB();
  const admin = db.users[0];
  const P = DEMO_PASSWORD;

  const carlos = await makeUser('Carlos Alberto Martínez Ruiz', 'carlos.martinez', P, 'M', '1980-07-22', ['guias', 'conquistadores'], ['director']);
  const maria = await makeUser('María José Hernández Flores', 'maria.hernandez', P, 'F', '1990-11-02', ['guias', 'conquistadores'], ['director_asociado']);
  const ana = await makeUser('Ana Lucía Ramírez Torres', 'ana.ramirez', P, 'F', '1988-02-17', ['guias', 'aventureros'], ['director']);
  const jose = await makeUser('José Miguel Castro Díaz', 'jose.castro', P, 'M', '2002-08-09', ['guias', 'conquistadores'], ['consejero']);
  const lucia = await makeUser('Lucía Beatriz Morales Peña', 'lucia.morales', P, 'F', '1995-12-05', ['guias', 'aventureros'], ['instructor', 'consejero']);
  const sofia = await makeUser('Sofía Elena Gómez Rivas', 'sofia.gomez', P, 'F', '2013-05-20', ['conquistadores'], ['miembro', 'secretario']);
  const diego = await makeUser('Diego Alejandro Pérez Mejía', 'diego.perez', P, 'M', '2014-02-08', ['conquistadores'], ['miembro']);
  const valeria = await makeUser('Valeria Isabel Cruz Molina', 'valeria.cruz', P, 'F', '2012-09-30', ['conquistadores'], ['miembro', 'tesorero']);
  const mateo = await makeUser('Mateo Andrés López Vásquez', 'mateo.lopez', P, 'M', '2019-06-12', ['aventureros'], ['miembro']);
  const camila = await makeUser('Camila Fernanda Rivera Ortiz', 'camila.rivera', P, 'F', '2018-01-25', ['aventureros'], ['miembro']);
  const daniel = await makeUser('Daniel Ernesto Flores Serrano', 'daniel.flores', P, 'M', '2007-04-03', ['guias'], ['miembro', 'capellan']);

  db.users.push(carlos, maria, ana, jose, lucia, sofia, diego, valeria, mateo, camila, daniel);

  const today = new Date();
  const d = (n: number) => toISO(addDays(today, n));
  // Próximo sábado / domingo
  const nextSat = (6 - today.getDay() + 7) % 7 || 7;
  const nextSun = (7 - today.getDay()) % 7 || 7;

  const act = (clubIds: ClubId[], title: string, description: string, date: string, startTime: string, location: string, endTime?: string, by = carlos.id): Activity => ({
    id: newId(), clubIds, title, description, date, startTime, endTime, location, createdBy: by, createdAt: nowISO(),
  });

  db.activities = [
    act(['conquistadores'], 'Reunión regular de Conquistadores', 'Uniforme de diario. Traer cuaderno de clases y Biblia.', d(nextSun), '08:00', 'Iglesia Belén SM', '11:00'),
    act(['aventureros'], 'Reunión de Aventureros', 'Actividad de manualidades. Traer tijeras y pegamento.', d(nextSun), '08:30', 'Salón de Aventureros', '10:30', ana.id),
    act(['guias'], 'Investidura de Guías Mayores - preparación', 'Repaso de requisitos y práctica de la ceremonia.', d(nextSat), '15:00', 'Iglesia Belén SM', '17:00'),
    act(['aventureros', 'conquistadores', 'guias'], 'Campamento de fin de año', 'Campamento de todo el Club Belén SM. Se enviará la lista de materiales.', d(nextSat + 14), '06:00', 'Parque Nacional Montecristo', undefined, admin.id),
    act(['conquistadores'], 'Caminata ecológica', 'Ruta de 5 km. Llevar agua, gorra y bloqueador.', d(nextSat + 7), '07:00', 'Volcán de San Miguel (Chaparrastique), punto de reunión en la iglesia'),
    act(['aventureros', 'conquistadores'], 'Desfile de clubes', 'Desfile organizado por la Asociación. Uniforme de gala.', d(36), '07:30', 'Centro de San Miguel'),
    act(['guias'], 'Taller de liderazgo', 'Taller para consejeros e instructores.', d(-10), '14:00', 'Iglesia Belén SM'),
    act(['conquistadores'], 'Día del Conquistador', 'Celebración especial en el culto.', d(-35), '09:00', 'Iglesia Belén SM'),
    act(['aventureros'], 'Visita al asilo', 'Actividad de servicio comunitario.', d(-50), '09:00', 'Hogar de ancianos de San Miguel', undefined, ana.id),
    act(['aventureros', 'conquistadores', 'guias'], 'Noche de talentos', 'Presentaciones de todos los clubes.', d(65), '18:00', 'Iglesia Belén SM', undefined, admin.id),
    act(['conquistadores'], 'Práctica de marchas', 'Preparación para el desfile.', d(nextSat + 21), '15:00', 'Cancha de la iglesia'),
    act(['guias'], 'Retiro espiritual', 'Retiro de Guías Mayores.', d(80), '07:00', 'Centro de retiros El Edén', undefined, admin.id),
  ];

  const notice = (clubIds: ClubId[], title: string, body: string, urgent: boolean, hoursAgo: number, by = carlos.id): Notice => ({
    id: newId(), clubIds, title, body, urgent, createdBy: by, createdAt: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
  });
  db.notices = [
    notice(['conquistadores'], 'Cambio de hora', 'La reunión de este domingo empezará a las 8:00 a. m. en lugar de las 9:00 a. m.', true, 3),
    notice(['aventureros', 'conquistadores', 'guias'], 'Inscripción al campamento', 'La cuota del campamento es de $15. Último día para pagar: próximo domingo. Entregar al tesorero.', false, 26, admin.id),
    notice(['aventureros'], 'Traer uniforme completo', 'Este domingo habrá revisión de uniforme.', false, 50, ana.id),
    notice(['guias'], 'Lugar de reunión', 'La preparación de investidura será en el salón principal.', true, 8, admin.id),
    notice(['conquistadores'], 'Lista de materiales para caminata', 'Agua (1 litro), gorra, bloqueador, refrigerio y zapatos cómodos.', false, 72),
  ];

  const assign = (ids: string[], statusFn: (i: number) => Assignment['status'], seenFn: (i: number) => boolean): Record<string, Assignment> =>
    Object.fromEntries(ids.map((id, i) => [id, { status: statusFn(i), seen: seenFn(i) || statusFn(i) !== 'pendiente' }]));

  const cq = [sofia.id, diego.id, valeria.id];
  const task = (clubId: ClubId, title: string, description: string, dueDate: string, assignments: Record<string, Assignment>, by = jose.id): Task => ({
    id: newId(), clubId, title, description, dueDate, assignments, createdBy: by, createdAt: nowISO(),
  });
  const wk = startOfWeek(today);
  db.tasks = [
    task('conquistadores', 'Aprender 5 nudos básicos', 'Nudo llano, as de guía, ballestrinque, margarita y vuelta de braza. Practicar para demostrarlos el domingo.', toISO(addDays(wk, 6)), assign(cq, (i) => (i === 0 ? 'hecha' : 'pendiente'), (i) => i === 0)),
    task('conquistadores', 'Memorizar el voto y la ley', 'Recitar el voto y la ley del Conquistador sin ayuda.', toISO(addDays(wk, 4)), assign(cq, (i) => (i === 1 ? 'en_revision' : 'pendiente'), (i) => i !== 2)),
    task('conquistadores', 'Leer Marcos capítulos 1 al 4', 'Escribir un resumen de media página en tu cuaderno.', toISO(addDays(wk, 2)), assign(cq, () => 'pendiente', () => false), carlos.id),
    task('conquistadores', 'Traer lista de materiales del campamento', 'Revisar la lista con tus padres.', toISO(addDays(wk, -3)), assign(cq, (i) => (i === 2 ? 'pendiente' : 'hecha'), () => true), carlos.id),
    task('conquistadores', 'Especialidad de Astronomía: requisito 3', 'Dibujar 3 constelaciones visibles desde El Salvador.', toISO(addDays(wk, 9)), assign(cq, () => 'pendiente', (i) => i === 0)),
    task('aventureros', 'Colorear la historia de Noé', 'Hoja entregada en la reunión.', toISO(addDays(wk, 5)), assign([mateo.id, camila.id], (i) => (i === 0 ? 'hecha' : 'pendiente'), () => true), lucia.id),
    task('aventureros', 'Aprender el voto del Aventurero', 'Con ayuda de papá o mamá.', toISO(addDays(wk, 3)), assign([mateo.id, camila.id], () => 'pendiente', () => false), ana.id),
    task('guias', 'Plan de clase para Conquistadores', 'Preparar el plan de la clase Amigo para el próximo mes.', toISO(addDays(wk, 6)), assign([jose.id, lucia.id, daniel.id], (i) => (i === 0 ? 'en_revision' : 'pendiente'), (i) => i < 2), admin.id),
  ];

  // Reuniones del año (domingos) hasta hoy, con asistencia.
  const meetings: Meeting[] = [];
  const r = rng(42);
  const absences: Record<string, number> = { [sofia.id]: 0, [diego.id]: 3, [valeria.id]: 6, [mateo.id]: 0, [camila.id]: 4, [daniel.id]: 1 };
  const jan1 = new Date(today.getFullYear(), 0, 1);
  let sunday = addDays(jan1, (7 - jan1.getDay()) % 7);
  const sundays: string[] = [];
  while (sunday <= today) {
    sundays.push(toISO(sunday));
    sunday = addDays(sunday, 7);
  }
  for (const clubId of CLUB_IDS) {
    const members = db.users.filter((u) => u.clubs.includes(clubId));
    // Elegimos de antemano qué reuniones falta cada miembro
    const missing: Record<string, Set<number>> = {};
    for (const m of members) {
      const n = absences[m.id] ?? Math.floor(r() * 3);
      const set = new Set<number>();
      while (set.size < Math.min(n, sundays.length)) set.add(Math.floor(r() * sundays.length));
      missing[m.id] = set;
    }
    sundays.forEach((date, i) => {
      meetings.push({
        id: newId(),
        clubId,
        date,
        title: 'Reunión regular',
        presentIds: members.filter((m) => !missing[m.id].has(i)).map((m) => m.id),
        absentIds: members.filter((m) => missing[m.id].has(i)).map((m) => m.id),
        createdBy: carlos.id,
      });
    });
  }
  db.meetings = meetings;

  const ach = (userId: string, kind: Achievement['kind'], name: string, daysAgo: number, by = jose.id): Achievement => ({
    id: newId(), userId, kind, name, date: d(-daysAgo), grantedBy: by,
  });
  db.achievements = [
    ach(sofia.id, 'clase', 'Amigo', 700), ach(sofia.id, 'clase', 'Compañero', 330), ach(sofia.id, 'clase', 'Explorador', 20),
    ach(sofia.id, 'especialidad', 'Nudos', 400), ach(sofia.id, 'especialidad', 'Primeros auxilios básicos', 200),
    ach(sofia.id, 'especialidad', 'Natación principiante', 90), ach(sofia.id, 'especialidad', 'Astronomía', 15),
    ach(diego.id, 'clase', 'Amigo', 300), ach(diego.id, 'especialidad', 'Arte de contar historias', 60),
    ach(valeria.id, 'clase', 'Amigo', 900), ach(valeria.id, 'clase', 'Compañero', 500), ach(valeria.id, 'clase', 'Explorador', 150),
    ach(valeria.id, 'especialidad', 'Campamento I', 120),
    ach(mateo.id, 'clase', 'Rayitos de Sol', 200, lucia.id), ach(camila.id, 'clase', 'Constructores', 220, lucia.id),
    ach(daniel.id, 'clase', 'Guía', 500), ach(daniel.id, 'especialidad', 'Liderazgo', 100), ach(daniel.id, 'especialidad', 'Campamento III', 40),
    ach(admin.id, 'clase', 'Guía Mayor', 3000), ach(admin.id, 'clase', 'Guía Mayor Avanzado', 1500),
    ach(admin.id, 'especialidad', 'Liderazgo', 1000), ach(admin.id, 'especialidad', 'Primeros auxilios avanzado', 800),
  ];

  db.notifications = [
    { id: newId(), userId: admin.id, title: 'Bienvenido a Club Belén SM', body: 'Estos son datos de ejemplo. Puedes borrarlos desde Panel de administración.', read: false, createdAt: nowISO() },
  ];

  // Un cambio pendiente de aprobación hecho por la Directora Asociada.
  const pendingAction = {
    type: 'createNotice' as const,
    data: { clubIds: ['conquistadores'] as ClubId[], title: 'Recordatorio: pañoleta', body: 'Todos deben traer pañoleta y anillo el domingo.', urgent: false },
  };
  db.pending = [
    {
      id: newId(),
      action: pendingAction,
      clubId: 'conquistadores',
      summary: `Publicar aviso "${pendingAction.data.title}"`,
      createdBy: maria.id,
      createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
      status: 'pendiente',
    },
  ];
  db.notifications.push(
    { id: newId(), userId: admin.id, title: 'Cambio pendiente de aprobación', body: `${maria.fullName}: ${db.pending[0].summary}`, href: '/aprobaciones', read: false, createdAt: db.pending[0].createdAt },
    { id: newId(), userId: carlos.id, title: 'Cambio pendiente de aprobación', body: `${maria.fullName}: ${db.pending[0].summary}`, href: '/aprobaciones', read: false, createdAt: db.pending[0].createdAt },
  );
  for (const t of db.tasks) {
    for (const uid of Object.keys(t.assignments)) {
      if (!t.assignments[uid].seen) {
        db.notifications.push({ id: newId(), userId: uid, title: 'Nueva tarea asignada', body: t.title, href: `/tarea/${t.id}`, read: false, createdAt: nowISO() });
      }
    }
  }
  return db;
}
