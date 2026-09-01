export type SponsorPlacementOption = {
  id: string;
  label: string;
  placement: string;
  bannerLabel: string;
  widthPx: number;
  heightPx: number;
  hint: string;
};

export const SPONSOR_PLACEMENTS: SponsorPlacementOption[] = [
  {
    id: 'home-hero',
    label: 'Inicio — Banner principal',
    placement: 'banner',
    bannerLabel: 'Home — Hero superior',
    widthPx: 920,
    heightPx: 86,
    hint: 'Imagen o video horizontal, ancho completo del contenido.',
  },
  {
    id: 'cantina-hero',
    label: 'Cantina — Banner promo',
    placement: 'banner',
    bannerLabel: 'Cantina — Promo del día',
    widthPx: 768,
    heightPx: 112,
    hint: 'Banner promocional en la página de cantina.',
  },
  {
    id: 'sidebar',
    label: 'Sidebar — Lateral',
    placement: 'sidebar',
    bannerLabel: 'Sidebar — Lateral navegación',
    widthPx: 230,
    heightPx: 120,
    hint: 'Formato vertical compacto para barra lateral.',
  },
  {
    id: 'footer',
    label: 'Footer — Pie de página',
    placement: 'footer',
    bannerLabel: 'Footer — Franja inferior',
    widthPx: 920,
    heightPx: 64,
    hint: 'Franja baja, ideal para logos de sponsors.',
  },
];

export function placementOptionById(id: string) {
  return SPONSOR_PLACEMENTS.find((p) => p.id === id) ?? SPONSOR_PLACEMENTS[0];
}
