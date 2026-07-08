export const colors = {
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  blueLight: '#DBEAFE',
  blueSoft: '#EFF6FF',
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray700: '#334155',
  gray900: '#0F172A',
  red: '#EF4444',
  redSoft: '#FEF2F2',
  green: '#10B981',
  greenSoft: '#ECFDF5',
  // scheduling semantics (prototype: available / wish)
  amber: '#D97706',
  amberSoft: '#FEF3C7',
} as const;

export type ColorName = keyof typeof colors;
