# Task 4 — Editar un cruce a mano

## Estado

Implementado y commiteado en `feat/fixture-berger-cruces`.

Commit: `aedb22b feat(futbol): editar un cruce a mano con avisos, sin recalcular la fecha`

## Implementación

- Se agregó `collectCruceWarnings` con los cuatro avisos definidos en el brief y comparación de cruces mediante `pairKey`.
- Se agregó `FixtureGeneratorService.updateMatchCruces` como transacción:
  - devuelve 404 si el partido no existe;
  - devuelve 400 para local/visitante iguales o inscripciones inválidas/inactivas/ajenas al torneo;
  - conserva cancha, horario y `bloqueadoManual`;
  - actualiza solamente el cruce solicitado;
  - persiste incluso ante inconsistencias no bloqueantes y devuelve `warnings`;
  - recalcula `jornada.equipoLibreId` según los inscriptos ausentes.
- `FootballService` delega al generador.
- Se agregó `UpdateMatchCrucesDto` con ambos campos validados mediante `@IsUUID()`.
- Se expuso `PATCH /football/matches/:id/cruces` con `FOOTBALL_MUTATION_ROLES`.
- No se modificó la UI administrativa.

## TDD y pruebas

Se respetó el ciclo solicitado:

1. `test/cruce-warnings.test.ts` falló inicialmente porque no existía el módulo.
2. Tras implementar el colector, pasaron sus 4 pruebas.
3. Las pruebas DB nuevas fallaron inicialmente con `updateMatchCruces is not a function`.
4. Tras implementar la persistencia, pasó la suite DB.

Verificación final:

- `npm --prefix apps/api test -- test/cruce-warnings.test.ts test/berger.test.ts`: 15/15 pruebas aprobadas.
- `npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`: 10/10 pruebas aprobadas.
- `npx --no-install tsc -p apps/api/tsconfig.build.json --noEmit --incremental false`: aprobado.
- `git diff --check`: aprobado.

## Auto-revisión

- Los rechazos duros ocurren antes de cualquier escritura.
- La escritura del partido y la actualización del libre son atómicas.
- Los cruces repetidos se comparan sin depender de localía.
- El cálculo de avisos sustituye únicamente el partido editado al evaluar la jornada.
- No se reescriben otros partidos ni datos de programación.

## Observaciones

`npm --prefix apps/api run build` no pudo ejecutarse porque el binario local `nest` no está instalado/disponible en este worktree. La compilación TypeScript equivalente sobre fuentes de producción sí pasó mediante `tsconfig.build.json`.

## Correcciones de revisión

Archivos de cobertura:

- `apps/api/test/cruce-warnings.test.ts`
- `apps/api/test/db/fixture-berger.test.ts`

Comando:

`npm --prefix apps/api test -- test/cruce-warnings.test.ts`

Salida:

```text
✓ test/cruce-warnings.test.ts (4 tests)
Test Files  1 passed (1)
Tests  4 passed (4)
```

Comando:

`npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`

Salida:

```text
Database reset successful
✓ test/db/fixture-berger.test.ts (11 tests)
Test Files  1 passed (1)
Tests  11 passed (11)
```

Se cubrió que una inscripción inválida responde 400, que `equipoLibreId` queda en el inscripto esperado, que los demás cruces conservan sus inscripciones y que un partido sin jornada persiste el cambio sin recalcular libre.
