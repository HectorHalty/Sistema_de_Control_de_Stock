# Fixture por modelo de cruces (Berger) — Diseño

**Fecha:** 2026-09-11
**Proyecto:** admin de fútbol (`apps/web-admin` + `apps/api` módulo football)
**Estado:** aprobado para planificación

## Problema

La generación automática de fixture (`buildRoundPairs`, circle method con el
primer equipo fijo) **no reproduce** el modelo que usa la liga (PDFs
*MODELO FIXTURE 11 Y 13 EQUIPOS* y *CAT A* Clausura 2026). Los números del
Excel se reemplazan por nombres de equipo; entre Apertura y Clausura el mismo
cruce no debe caer en el mismo número de fecha; el administrador tiene que ver
el fixture en el admin y **confirmar** antes de que la web de clientes lo
muestre; y debe poder cambiar un partido a mano sin recalcular el resto.

Hoy `POST /football/torneos/:id/generate-fixture` pide `fechas` + `fechaInicio`,
escribe jornadas de inmediato y no hay edición de rival. La web pública ya
filtra por `jornada.publicada`; el hueco es el flujo generar → revisar →
publicar y el motor de cruces.

## Fuera de alcance (explícito)

- Auto-programar canchas, preferencias de horario, grilla del sábado
  multi-categoría, suspender por lluvia.
- Revancha (ida/vuelta extra) dentro del mismo torneo. Una generación = una
  vuelta.
- Numerar equipos a mano, elegir quién queda libre, o “arreglar el resto de
  la fecha” al editar un cruce.
- Rediseño de la pestaña Fixture en la web pública (solo respeta `publicada`,
  como ahora).
- Cambiar el modelo de `Campeonato` / `Torneo` / `Jornada` más allá de usar
  flags y relaciones que ya existen.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Motor | Un algoritmo Berger que clona las tablas del PDF para 7/8, 11/12 y 13/14, y la misma regla para cualquier N ≥ 2. |
| Numeración | Automática: 1…N por nombre de equipo (`es`, desempate por `equipoId`). |
| Tamaño | Impar: N fechas y un libre por fecha. Par: N−1 fechas, el equipo N ocupa el hueco del libre (1 vs 8, 1 vs 12, 1 vs 14). |
| Local / visitante | El número de la izquierda en el modelo es local. |
| Cantidad de fechas | No se elige. Siempre una vuelta. Solo se pide el sábado de inicio. |
| Apertura / Clausura | Mismo cruce (par de `equipoId`) no debe repetir número de fecha. Se corre cíclicamente la tabla. |
| Generar | Escribe jornadas y partidos con `publicada = false`. La web clientes no los ve. |
| Confirmar | Un botón publica **todas** las jornadas de ese torneo. Recién ahí salen en clientes. |
| Regenerar | Permitido solo si ninguna jornada está publicada y ningún partido tiene resultado ni WO. Borra el borrador y vuelve a generar. |
| Edición a mano | Después de generar, se cambia local/visitante o rival de **un** partido. El resto no se recalcula. Se guarda igual; solo avisos. |
| Avanzado | Crear jornada suelta sigue. “Generar cruces” de esa jornada usa el mismo Berger para `jornada.numero - 1`, **sin** corrimiento de temporada. |

## Enfoques considerados

1. **Un algoritmo Berger + tests contra el PDF + borrador sin publicar.** Elegido.
   Un criterio para todos los tamaños; el admin revisa y confirma; edición
   puntual después.
2. **Tablas literales 7/8, 11/12, 13/14 y circle method para el resto.** Cat. A
   quedaría clavada al Excel, pero 9 o 15 equipos no se parecerían al documento.
3. **Wizard editable en memoria antes de persistir.** Más UI de la pedida: la
   edición es sobre partidos ya creados, no publicados.

## Arquitectura

```text
Admin FixturePanel
  POST /football/torneos/:id/generate-fixture     { fechaInicio }
       → Berger + corrimiento → jornadas/partidos publicada=false
  GET  /football/partidos?torneoId=                 tabla tipo Cat. A
  PATCH /football/partidos/:id/cruces               un partido; warnings[]
  POST /football/torneos/:id/publish-fixture        todas las jornadas publicadas
  POST /football/torneos/:id/generate-fixture       otra vez = regenerar borrador

Web pública
  GET partidos/jornadas del torneo                  solo jornada.publicada=true
```

Unidades:

| Unidad | Qué hace | Cómo se usa | Depende de |
|---|---|---|---|
| `buildBergerRounds(n)` | Tabla numérica 1…N, una vuelta, pares ordenados (local, visitante) y bye por ronda. | Pura, testeable contra el PDF. | Nada. |
| `numberTeams(inscripciones)` | Asigna 1…N. | El generador. | Nombre del equipo. |
| `shiftRounds(rounds, previousPairs)` | Elige desfasaje cíclico. | El generador, si hay torneo hermano. | Partidos del otro campeonato de la misma categoría y temporada. |
| `FixtureGeneratorService.generateFullSeason` | Transacción: (opcional borrar borrador) + crear jornadas/partidos. | `POST generate-fixture`. | Las tres unidades de arriba, Prisma. |
| `publishFixture(torneoId)` | `publicada=true` en todas las jornadas del torneo. | `POST publish-fixture`. | Jornadas existentes. |
| `updateMatchCruces` | Cambia local/visitante de un partido y arma avisos. | `PATCH .../cruces`. | Inscripciones del torneo. |

Reemplaza `buildRoundPairs` (circle method) en generación de temporada y en
`generateRoundRobin` de una jornada. `createMatchesForPairs` se reutiliza.

No hace falta tabla nueva ni campo `numeroFixture`. El número 1…N vive solo
durante la generación.

## Motor numérico

### Una vuelta

- N impar: R = N rondas, un bye por ronda.
- N par: R = N − 1 rondas, sin bye. Se calcula el Berger de N−1 equipos
  (números 1…N−1) y el equipo N juega contra quien habría quedado libre.

Fecha de jornada i (1-based): `fechaInicio + (i - 1) * 7` días.

### Ronda base (offset 0), N impar

Libre = 1. Partidos: (2, N), (3, N−1), (4, N−2), … hasta agotar. Izquierda =
local.

Para 13 equipos coincide con el PDF fecha 1: libre 1; 2–13, 3–12, 4–11, 5–10,
6–9, 7–8.

Para 11: libre 1; 2–11, 3–10, 4–9, 5–8, 6–7 (el “12” del PDF de 11/12 es el
hueco; con 11 equipos no existe).

Para 7: libre 1; 2–7, 3–6, 4–5.

### Rondas siguientes (N impar)

Ronda k (0-based). Desfasaje de etiquetas:

- k par: `offset = k / 2`
- k impar: `offset = floor(k / 2) + (N + 1) / 2`

Cada número x de la ronda 0 pasa a `((x - 1 + offset) mod N) + 1`. El orden
local/visitante de cada par se mantiene.

Eso reproduce fecha 2 de 13 equipos: libre 8; 9–7, 10–6, 11–5, 12–4, 13–3, 1–2.

### N par (el “o 8 / o 12 / o 14” del PDF)

Misma ronda impar, y el partido extra:

- Fechas impares (k par): local = quien era libre, visitante = N (1 vs 8).
- Fechas pares (k impar): local = N, visitante = quien era libre (8 vs 5).

### Numeración de equipos

Inscripciones `activo=true`, orden:

1. `equipo.name.localeCompare(..., 'es', { sensitivity: 'base' })`
2. `equipoId` ascendente si empatan.

Ese orden **es** 1…N. No se persiste.

## Corrimiento Apertura / Clausura

Al generar el torneo T:

1. Buscar el otro `Campeonato` de la misma `temporadaId` (Apertura ↔ Clausura).
2. En ese campeonato, el `Torneo` con el mismo `categoriaId`.
3. Si no hay, o no tiene partidos, desfasaje **0** (fecha 1 del modelo = jornada 1).

Mapa del torneo anterior: para cada partido, clave `{min(homeTeamId, awayTeamId), max(...)}` → `jornada.numero`.

Las rondas Berger se rotan: jornada 1 muestra la ronda `s` del modelo, jornada 2
la `s+1`, etc. (índices mod R).

Si R = 1 (dos equipos), no hay corrimiento posible: jornada 1 queda como el
modelo.

Si R ≥ 2: elegir el menor `s` en `1 … R-1` que deje **cero** cruces solapados
(misma clave de equipos) con el mismo `jornada.numero` que en el torneo
anterior. Si ninguno llega a cero (planteles distintos, R distinto), mirar
también `s = 0` y elegir el desfasaje con menos choques; empate → preferir
`s ≠ 0`, luego el más chico.

Con el mismo plantel y el mismo N, `s = 1` alcanza: ningún cruce conserva el
número de fecha.

El bye no cuenta como cruce. Local/visitante invertido es el mismo cruce.

La respuesta de generar incluye `offset`, `choques` y `torneoReferenciaId`
(null si no hubo hermano).

## Flujo de datos: generar, ver, confirmar

### Generar (`POST .../generate-fixture`)

Body: `{ fechaInicio: string }` (ISO date). **Se elimina `fechas`.**

Avisos de UI (no bloquean): `fechaInicio` que no cae sábado.

Errores (transacción abortada, nada a medias):

| Caso | HTTP |
|---|---|
| Torneo inexistente | 404 |
| Menos de 2 inscriptos activos | 400 |
| Sin `fechaInicio` | 400 |
| Hay jornadas y **no** es regenerable | 400, mensaje actual + “usá Avanzado…” |

Regenerable = hay jornadas, **ninguna** `publicada`, y ningún partido del
torneo tiene `status != pendiente`, goles no nulos, o `esWO`. Entonces se
borran primero los `PartidoFutbol` de esas jornadas y después las jornadas
(`jornadaId` en partidos es `onDelete: SetNull`; no alcanza con borrar
jornadas). Preferencias de horario de esas jornadas caen en cascade.

Toda jornada nueva nace con `publicada: false` y `equipoLibreId` según el
modelo (null si N par).

### Ver en admin

Tabla tipo Cat. A: una fila por jornada, columnas Libre + Partido 1…k, celdas
con **nombres**. Datos: `GET` partidos del torneo (no solo la jornada
seleccionada).

El selector de jornada, auto-programar canchas, publicar una jornada, lluvia y
Avanzado **siguen**.

Botones nuevos junto al wizard:

- **Confirmar y publicar** — llama `publish-fixture`. Deshabilitado si no hay
  jornadas o si alguna ya está publicada.
- **Volver a generar** — mismo `generate-fixture`. Visible solo si es
  regenerable. Pedir confirmación (“se borra el borrador”).

El wizard ya no pide cantidad de fechas.

### Confirmar (`POST .../publish-fixture`)

Pone `publicada: true` en **todas** las jornadas del torneo.

| Caso | HTTP |
|---|---|
| Sin jornadas | 400 |
| Alguna jornada ya publicada | 400, no toca nada |

La web pública no cambia de contrato: sigue listando partidos cuya jornada
está publicada y no suspendida. El vacío de clientes hasta confirmar es el
mismo copy de hoy (“cuando el torneo esté generado y publicado”).

Publicar una jornada suelta (`POST jornadas/:id/publish`) y publicar por fecha
de sábado **siguen** para casos puntuales. El flujo feliz del fixture automático
es el botón de torneo.

## Edición a mano de un cruce

`PATCH /football/partidos/:id/cruces`

Body: `{ homeInscripcionId, awayInscripcionId }` (ambos inscriptos activos del
mismo torneo). Se actualizan también `homeTeamId` / `awayTeamId`. No se tocan
otros partidos, cancha, hora, ni `bloqueadoManual`.

Rechazo duro (no guarda):

- Partido inexistente → 404.
- Misma inscripción local y visitante → 400.
- Inscripción ajena al torneo o inactiva → 400.

El resto **guarda** y devuelve `warnings: string[]`:

- Un equipo juega dos veces en esa jornada.
- Un equipo no juega y no es el libre (o hay más de un ausente).
- El mismo par de `equipoId` ya existe en otra jornada del torneo.
- El partido tiene resultado, WO, o su jornada está publicada (la tabla de
  posiciones puede quedar vieja hasta recargar resultados).

Después del PATCH, si exactamente un inscripto del torneo no aparece en ningún
partido de esa jornada, se actualiza `jornada.equipoLibreId` a ese inscripto;
si no, se pone `null` y entra en los avisos. Eso no reescribe partidos.

La UI: en la tabla o en la tarjeta, dos selects (local / visitante). Mostrar
los avisos al guardar; no bloquear.

## Componentes de UI (admin)

- `FixturePanel` / `TorneoFixtureWizard`: solo `fechaInicio` + generar;
  estados de borrador vs publicado; confirmar; regenerar.
- Nueva tabla de temporada (nombres, filas = fechas). Puede vivir junto a
  `FixtureGridPreview` (esa grilla sigue siendo cancha × hora, no se mezcla).
- Edición de cruces en la tabla / tarjetas existentes.

Sin pantallas nuevas de navegación. La web pública no se rediseña: el filtro
`jornada.publicada` ya existe; el spec solo exige un test que lo cubra antes y
después de `publish-fixture`.

## Testing

Puros (sin Prisma), anclados a los PDFs:

- 7, 8, 11, 12, 13 y 14 equipos: ronda 0 y al menos ronda 1 iguales al modelo
  (libres y pares, incluyendo local/visitante en 8 equipos fecha 2 = 8 vs 5).
- 13 equipos, 13 rondas: cada par aparece una sola vez; cada equipo un bye.
- 12 equipos, 11 rondas: cada par una sola vez; nadie libre.

Servicio / API:

- 13 inscriptos → 13 jornadas, `publicada=false`, un libre por fecha.
- 12 inscriptos → 11 jornadas, `equipoLibreId` null.
- Mismo plantel, Apertura luego Clausura: cero pares con el mismo
  `jornada.numero`.
- Pública no lista partidos de jornada no publicada; después de
  `publish-fixture`, sí.
- Regenerar borra y recrea si es borrador; 400 si hay una jornada publicada o
  un resultado.
- `PATCH cruces` cambia solo ese partido; warnings si el rival ya juega esa
  fecha; 400 si local = visitante.

UI: el wizard no muestra cantidad de fechas; con borrador se ve confirmar; la
tabla muestra nombres, no 1 vs 2.

## Error handling (resumen)

- Generar es atómico. Fallo → cero jornadas nuevas (o el borrador anterior
  intacto si falló un regenerar a mitad — la transacción incluye el delete).
- Confirmar no es parcial: o publican todas o ninguna (el 400 por “ya hay una
  publicada” evita mezclar).
- Editar cruces es permisivo salvo identidad de equipos.
- El “no es sábado” es warning de UI, no 400.

## Criterio de hecho

Un administrador de Cat. A con 13 equipos genera Clausura un sábado, ve la
tabla con nombres (no números), Discoteca no está forzada a ser el 1 (sale por
orden alfabético), la web clientes sigue vacía, cambia un rival y se guarda
con aviso si pisa otro partido, confirma, y recién ahí el fixture aparece en
clientes. Si Apertura de la misma categoría ya tenía fixture, ningún cruce
repetido cae en el mismo número de fecha.
