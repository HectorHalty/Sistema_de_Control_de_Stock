const GRUPOS = [
  {
    codigo: 'mujeres',
    nombre: 'Mujeres',
    canchas: [1, 2, 3, 4],
    franjas: ['12:00', '13:00', '14:00', '15:00', '16:00'],
  },
  {
    codigo: 'hombres_a',
    nombre: 'Hombres A',
    canchas: [1, 2, 3],
    franjas: ['11:30', '13:00', '14:30', '16:00'],
  },
  {
    codigo: 'hombres_b',
    nombre: 'Hombres B',
    canchas: [5, 6, 7, 8],
    franjas: ['11:45', '13:15', '14:45', '16:15'],
  },
];

const CATEGORIAS = [
  { codigo: 'hombres_libre_a', nombre: 'Libre A', genero: 'hombres', maxPlantel: 20, minJugadores: 6, grupo: 'hombres_a', colorHex: '#6BFF9E' },
  { codigo: 'hombres_libre_b', nombre: 'Libre B', genero: 'hombres', maxPlantel: 20, minJugadores: 6, grupo: 'hombres_b', colorHex: '#4ADE80' },
  { codigo: 'hombres_libre_c', nombre: 'Libre C', genero: 'hombres', maxPlantel: 20, minJugadores: 6, grupo: 'hombres_b', colorHex: '#22C55E' },
  { codigo: 'hombres_superliga_a', nombre: 'Superliga A', genero: 'hombres', maxPlantel: 21, minJugadores: 6, grupo: 'hombres_a', colorHex: '#A3E635' },
  { codigo: 'hombres_superliga_b', nombre: 'Superliga B', genero: 'hombres', maxPlantel: 21, minJugadores: 6, grupo: 'hombres_b', colorHex: '#84CC16' },
  { codigo: 'mujeres_a', nombre: 'Mujeres A', genero: 'mujeres', maxPlantel: 16, minJugadores: 5, grupo: 'mujeres', colorHex: '#F472B6' },
  { codigo: 'mujeres_b', nombre: 'Mujeres B', genero: 'mujeres', maxPlantel: 16, minJugadores: 5, grupo: 'mujeres', colorHex: '#EC4899' },
  { codigo: 'mujeres_c', nombre: 'Mujeres C', genero: 'mujeres', maxPlantel: 16, minJugadores: 5, grupo: 'mujeres', colorHex: '#DB2777' },
];

async function seedScheduling(prisma) {
  const grupoIds = {};

  for (const g of GRUPOS) {
    const grupo = await prisma.grupoCanchas.upsert({
      where: { codigo: g.codigo },
      update: { nombre: g.nombre },
      create: { codigo: g.codigo, nombre: g.nombre },
    });
    grupoIds[g.codigo] = grupo.id;

    for (const numero of g.canchas) {
      await prisma.cancha.upsert({
        where: { grupoCanchasId_numero: { grupoCanchasId: grupo.id, numero } },
        update: { activa: true },
        create: { grupoCanchasId: grupo.id, numero, nombre: `Cancha ${numero}` },
      });
    }

    for (let i = 0; i < g.franjas.length; i++) {
      await prisma.franjaHoraria.upsert({
        where: { grupoCanchasId_horaInicio: { grupoCanchasId: grupo.id, horaInicio: g.franjas[i] } },
        update: { orden: i },
        create: {
          grupoCanchasId: grupo.id,
          horaInicio: g.franjas[i],
          duracionMinutos: 90,
          orden: i,
        },
      });
    }
  }

  for (const cat of CATEGORIAS) {
    await prisma.categoriaConfig.upsert({
      where: { codigo: cat.codigo },
      update: {
        nombre: cat.nombre,
        genero: cat.genero,
        maxPlantel: cat.maxPlantel,
        minJugadoresInicio: cat.minJugadores,
        grupoCanchasId: grupoIds[cat.grupo],
        colorHex: cat.colorHex,
      },
      create: {
        codigo: cat.codigo,
        nombre: cat.nombre,
        genero: cat.genero,
        maxPlantel: cat.maxPlantel,
        maxIncorporaciones: 3,
        minJugadoresInicio: cat.minJugadores,
        grupoCanchasId: grupoIds[cat.grupo],
        colorHex: cat.colorHex,
      },
    });
  }

  console.log(`Scheduling: ${GRUPOS.length} grupos, ${CATEGORIAS.length} categorías.`);
}

module.exports = { seedScheduling, CATEGORIAS };
