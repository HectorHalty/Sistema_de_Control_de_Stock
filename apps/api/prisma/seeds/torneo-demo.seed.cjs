const DEMO_EQUIPOS = [
  { name: 'La Chacra FC', shortName: 'LCH', color: '#6BFF9E' },
  { name: 'Deportivo Norte', shortName: 'DN', color: '#60A5FA' },
  { name: 'Atlético Sur', shortName: 'AS', color: '#F87171' },
  { name: 'Unión del Parque', shortName: 'UP', color: '#FBBF24' },
  { name: 'Sporting Villa', shortName: 'SV', color: '#A78BFA' },
  { name: 'Club Estrella', shortName: 'CE', color: '#34D399' },
];

const DEMO_JUGADORES = [
  { dni: '30123456', nombre: 'Juan', apellido: 'Pérez', email: 'jugador@lachacra.test', rolPlantel: 'jugador' },
  { dni: '31234567', nombre: 'María', apellido: 'González', email: 'maria.gonzalez@demo.test', rolPlantel: 'jugador' },
  { dni: '32345678', nombre: 'Lucas', apellido: 'Rodríguez', email: 'lucas.rodriguez@demo.test', rolPlantel: 'jugador' },
  { dni: '33456789', nombre: 'Sofía', apellido: 'López', email: 'sofia.lopez@demo.test', rolPlantel: 'subcapitan' },
  { dni: '34567890', nombre: 'Diego', apellido: 'Martínez', email: 'diego.martinez@demo.test', rolPlantel: 'jugador' },
];

function nextSaturday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const add = day === 6 ? 7 : (6 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(14, 0, 0, 0);
  return d;
}

async function seedTorneoDemo(prisma) {
  const anio = new Date().getFullYear();
  const temporada = await prisma.temporada.upsert({
    where: { anio },
    update: { activa: true, nombre: `Temporada ${anio}` },
    create: {
      nombre: `Temporada ${anio}`,
      anio,
      activa: true,
      inicio: new Date(`${anio}-02-01`),
      fin: new Date(`${anio}-12-15`),
    },
  });

  await prisma.temporada.updateMany({
    where: { id: { not: temporada.id } },
    data: { activa: false },
  });

  const campeonato = await prisma.campeonato.upsert({
    where: { temporadaId_nombre: { temporadaId: temporada.id, nombre: 'Apertura' } },
    update: { activo: true },
    create: {
      temporadaId: temporada.id,
      nombre: 'Apertura',
      activo: true,
      inicio: new Date(`${anio}-02-15`),
    },
  });

  const categoria = await prisma.categoriaConfig.findUnique({
    where: { codigo: 'hombres_libre_a' },
  });
  if (!categoria) {
    console.warn('Categoría hombres_libre_a no encontrada — ejecutá seedScheduling primero.');
    return;
  }

  const torneo = await prisma.torneo.upsert({
    where: {
      campeonatoId_categoriaId: { campeonatoId: campeonato.id, categoriaId: categoria.id },
    },
    update: { activo: true, publicado: true, nombre: 'Libre A — Apertura' },
    create: {
      campeonatoId: campeonato.id,
      categoriaId: categoria.id,
      nombre: 'Libre A — Apertura',
      activo: true,
      publicado: true,
    },
  });

  await prisma.torneoConfig.upsert({
    where: { torneoId: torneo.id },
    update: {},
    create: { torneoId: torneo.id },
  });

  const equipoRecords = [];
  for (const eq of DEMO_EQUIPOS) {
    const equipo = await prisma.equipoFutbol.upsert({
      where: { name: eq.name },
      update: { shortName: eq.shortName, color: eq.color },
      create: { name: eq.name, shortName: eq.shortName, color: eq.color },
    });
    const inscripcion = await prisma.equipoInscripcion.upsert({
      where: { torneoId_equipoId: { torneoId: torneo.id, equipoId: equipo.id } },
      update: { activo: true, abbr: eq.shortName, color: eq.color },
      create: {
        torneoId: torneo.id,
        equipoId: equipo.id,
        abbr: eq.shortName,
        color: eq.color,
      },
    });
    equipoRecords.push({ equipo, inscripcion });
  }

  const capitanEquipo = equipoRecords[0];
  const capitanEmail = 'capitan@lachacra.test';
  const capitanDni = '28123456';

  const existingCap = await prisma.capitanAutorizado.findFirst({
    where: {
      torneoId: torneo.id,
      OR: [{ email: capitanEmail }, { dni: capitanDni }],
    },
  });

  if (existingCap) {
    await prisma.capitanAutorizado.update({
      where: { id: existingCap.id },
      data: {
        email: capitanEmail,
        dni: capitanDni,
        equipoInscripcionId: capitanEquipo.inscripcion.id,
        activo: true,
      },
    });
  } else {
    await prisma.capitanAutorizado.create({
      data: {
        email: capitanEmail,
        dni: capitanDni,
        torneoId: torneo.id,
        equipoInscripcionId: capitanEquipo.inscripcion.id,
        activo: true,
      },
    });
  }

  for (const j of DEMO_JUGADORES) {
    const persona = await prisma.persona.upsert({
      where: { dni: j.dni },
      update: {
        nombre: j.nombre,
        apellido: j.apellido,
        email: j.email,
        fechaNacimiento: new Date('1995-06-15'),
      },
      create: {
        dni: j.dni,
        nombre: j.nombre,
        apellido: j.apellido,
        email: j.email,
        fechaNacimiento: new Date('1995-06-15'),
      },
    });

    await prisma.inscripcionJugador.upsert({
      where: { personaId_torneoId: { personaId: persona.id, torneoId: torneo.id } },
      update: {
        equipoInscripcionId: capitanEquipo.inscripcion.id,
        rolPlantel: j.rolPlantel,
        activa: true,
      },
      create: {
        personaId: persona.id,
        torneoId: torneo.id,
        equipoInscripcionId: capitanEquipo.inscripcion.id,
        rolPlantel: j.rolPlantel,
        activa: true,
      },
    });
  }

  const cancha = await prisma.cancha.findFirst({
    where: { numero: 1, grupoCanchas: { codigo: 'hombres_a' } },
  });

  const jornadaFecha = nextSaturday();
  const jornada = await prisma.jornada.upsert({
    where: { torneoId_numero: { torneoId: torneo.id, numero: 1 } },
    update: { fecha: jornadaFecha, publicada: true },
    create: {
      torneoId: torneo.id,
      numero: 1,
      fecha: jornadaFecha,
      publicada: true,
    },
  });

  const [home, away] = equipoRecords;
  const partidoDate = new Date(jornadaFecha);
  partidoDate.setHours(14, 0, 0, 0);

  const existingMatch = await prisma.partidoFutbol.findFirst({
    where: {
      torneoId: torneo.id,
      homeTeamId: home.equipo.id,
      awayTeamId: away.equipo.id,
      jornadaId: jornada.id,
    },
  });

  if (!existingMatch) {
    await prisma.partidoFutbol.create({
      data: {
        torneoId: torneo.id,
        jornadaId: jornada.id,
        homeTeamId: home.equipo.id,
        awayTeamId: away.equipo.id,
        homeInscripcionId: home.inscripcion.id,
        awayInscripcionId: away.inscripcion.id,
        canchaId: cancha?.id,
        horaInicio: '14:00',
        date: partidoDate,
        venue: cancha ? `Cancha ${cancha.numero}` : 'Cancha 1',
        status: 'pendiente',
      },
    });
  }

  const played = await prisma.partidoFutbol.findFirst({
    where: {
      torneoId: torneo.id,
      homeTeamId: equipoRecords[2].equipo.id,
      awayTeamId: equipoRecords[3].equipo.id,
    },
  });

  if (!played) {
    const playedDate = new Date(jornadaFecha);
    playedDate.setDate(playedDate.getDate() - 7);
    await prisma.partidoFutbol.create({
      data: {
        torneoId: torneo.id,
        jornadaId: jornada.id,
        homeTeamId: equipoRecords[2].equipo.id,
        awayTeamId: equipoRecords[3].equipo.id,
        homeInscripcionId: equipoRecords[2].inscripcion.id,
        awayInscripcionId: equipoRecords[3].inscripcion.id,
        canchaId: cancha?.id,
        horaInicio: '13:00',
        date: playedDate,
        venue: cancha ? `Cancha ${cancha.numero}` : 'Cancha 1',
        status: 'jugado',
        homeGoals: 2,
        awayGoals: 1,
      },
    });
  }

  const playedMatch = await prisma.partidoFutbol.findFirst({
    where: {
      torneoId: torneo.id,
      homeTeamId: equipoRecords[2].equipo.id,
      awayTeamId: equipoRecords[3].equipo.id,
      status: 'jugado',
    },
  });

  if (playedMatch) {
    const scorerPersona = await prisma.persona.findUnique({ where: { dni: DEMO_JUGADORES[0].dni } });
    if (scorerPersona) {
      const existingGoals = await prisma.eventoPartido.count({
        where: { partidoId: playedMatch.id, personaId: scorerPersona.id, tipo: 'gol' },
      });
      if (existingGoals === 0) {
        await prisma.eventoPartido.createMany({
          data: [
            { partidoId: playedMatch.id, personaId: scorerPersona.id, tipo: 'gol', minuto: 12 },
            { partidoId: playedMatch.id, personaId: scorerPersona.id, tipo: 'gol', minuto: 44 },
          ],
        });
      }
    }
  }

  console.log(`Torneo demo: ${DEMO_EQUIPOS.length} equipos, categoría Libre A, jornada 1.`);

  const { CATEGORIAS } = require('./scheduling.seed.cjs');
  for (const cat of CATEGORIAS) {
    const categoriaRow = await prisma.categoriaConfig.findUnique({ where: { codigo: cat.codigo } });
    if (!categoriaRow) continue;
    await prisma.torneo.upsert({
      where: {
        campeonatoId_categoriaId: { campeonatoId: campeonato.id, categoriaId: categoriaRow.id },
      },
      update: { activo: true },
      create: {
        campeonatoId: campeonato.id,
        categoriaId: categoriaRow.id,
        nombre: `${cat.nombre} — ${campeonato.nombre}`,
        activo: true,
        publicado: cat.codigo === 'hombres_libre_a',
      },
    });
  }
  console.log(`Torneos bootstrap: ${CATEGORIAS.length} categorías en ${campeonato.nombre}.`);
}

module.exports = { seedTorneoDemo };
