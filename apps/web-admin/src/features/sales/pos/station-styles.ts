/** Estilos de color por estación/cocina. Para cocinas custom, color por defecto. */
const STATION_STYLE: Record<string, string> = {
  Parrilla: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  Barra: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  Cervecería: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  Cocina: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
};

const DEFAULT_STATION_STYLE = 'bg-muted text-muted-foreground';

export function getStationStyle(station: string): string {
  return STATION_STYLE[station] ?? DEFAULT_STATION_STYLE;
}
