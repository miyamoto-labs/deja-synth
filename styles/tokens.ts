export const tokens = {
  cream:      '#F5EFE0',
  warmWhite:  '#FAF7F2',
  amber:      '#C8843A',
  amberLight: '#E4A95A',
  amberGlow:  'rgba(200,132,58,0.15)',
  dustyRose:  '#C4967A',
  brownDark:  '#2C1F14',
  brownMid:   '#3D2A18',
  brownSoft:  '#8B6347',
  sage:       '#7A8C6E',
  charcoal:   '#141009',
} as const;

export type TokenKey = keyof typeof tokens;
