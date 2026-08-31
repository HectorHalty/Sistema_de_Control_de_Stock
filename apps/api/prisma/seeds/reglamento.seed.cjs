const fs = require('fs');
const path = require('path');

const ROMAN_TO_NUM = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
};

async function seedReglamento(prisma) {
  const dataPath = path.join(__dirname, 'reglamento-data.json');
  if (!fs.existsSync(dataPath)) {
    console.warn('reglamento-data.json no encontrado — omitiendo seed de reglamento.');
    console.warn('Ejecutá: node prisma/seeds/build-reglamento-data.mjs');
    return;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  for (const apartado of data.apartados) {
    const numero = ROMAN_TO_NUM[apartado.numeroRomano] ?? 0;
    const dbApartado = await prisma.reglamentoApartado.upsert({
      where: { numero },
      update: { titulo: apartado.titulo, orden: numero },
      create: { numero, titulo: apartado.titulo, orden: numero },
    });

    for (let i = 0; i < apartado.articulos.length; i++) {
      const art = apartado.articulos[i];
      await prisma.reglamentoArticulo.upsert({
        where: {
          apartadoId_numero: {
            apartadoId: dbApartado.id,
            numero: art.numero,
          },
        },
        update: {
          contenido: art.contenido,
          aplicable: art.aplicable,
          orden: i + 1,
        },
        create: {
          apartadoId: dbApartado.id,
          numero: art.numero,
          contenido: art.contenido,
          aplicable: art.aplicable,
          orden: i + 1,
        },
      });
    }
  }

  for (const anexo of data.anexos) {
    const dbAnexo = await prisma.reglamentoAnexo.upsert({
      where: { numero: anexo.numero },
      update: { titulo: anexo.titulo, orden: anexo.numero },
      create: { numero: anexo.numero, titulo: anexo.titulo, orden: anexo.numero },
    });

    await prisma.reglamentoRegla.upsert({
      where: {
        anexoId_clave: {
          anexoId: dbAnexo.id,
          clave: 'contenido',
        },
      },
      update: { contenido: anexo.contenido },
      create: {
        anexoId: dbAnexo.id,
        clave: 'contenido',
        titulo: anexo.titulo,
        contenido: anexo.contenido,
        orden: 1,
      },
    });
  }

  console.log(
    `Reglamento: ${data.apartados.length} apartados, ${data.apartados.reduce((n, a) => n + a.articulos.length, 0)} artículos, ${data.anexos.length} anexos.`,
  );
}

module.exports = { seedReglamento };
