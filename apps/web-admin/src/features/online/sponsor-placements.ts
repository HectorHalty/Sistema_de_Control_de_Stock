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
    id: 'home',
    label: 'Inicio — Banner principal',
    placement: 'home',
    bannerLabel: 'Inicio — Banner principal',
    widthPx: 920,
    heightPx: 86,
    hint: 'Imagen o video horizontal, ancho completo del contenido.',
  },
  {
    id: 'cantina',
    label: 'Cantina — Banner promo',
    placement: 'cantina',
    bannerLabel: 'Cantina — Banner promo',
    widthPx: 768,
    heightPx: 112,
    hint: 'Banner promocional en la página de cantina.',
  },
];

export function placementOptionById(id: string) {
  return SPONSOR_PLACEMENTS.find((p) => p.id === id) ?? SPONSOR_PLACEMENTS[0];
}
