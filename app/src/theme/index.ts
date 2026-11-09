import { useContext } from 'react';
import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import { ThemeModeContext } from './mode';

/**
 * "Hearth": warm cream walls, sage like a houseplant on the sill,
 * apricot and honey like late-afternoon light.
 */
const light = {
  scheme: 'light' as 'light' | 'dark',
  bg: '#FBF6EE',
  bgTop: '#F9E6D3',
  surface: '#FFFDF9',
  surfaceAlt: '#FAF4EA',
  sunken: '#F3EBDF',
  ink: '#3B322C',
  inkSoft: '#6E625A',
  inkFaint: '#A3968C',
  line: '#EDE3D6',
  primary: '#4F7D5F',
  primaryPressed: '#446E52',
  primaryInk: '#FFFFFF',
  primarySoft: '#E3EFE5',
  lavender: '#9888D8',
  lavenderSoft: '#EFEBFA',
  peach: '#E58B66',
  peachSoft: '#FCEADF',
  sage: '#6FA57E',
  sageSoft: '#E4F0E6',
  sky: '#6FA6CC',
  skySoft: '#E5F0F7',
  butter: '#D9A940',
  butterSoft: '#FBF0D4',
  rose: '#DE8585',
  roseSoft: '#FBE8E6',
  danger: '#C8553D',
  dangerSoft: '#FBE3DC',
  success: '#3F8A5A',
  overlay: 'rgba(59, 50, 44, 0.35)',
  shadow: '#7A5C44',
  /** Page backdrop behind the phone column on web. */
  frame: '#EFE6D9',
};

export type Palette = typeof light;

/** "Evening in": the same room with the lamps on, warm browns instead of cold blue-black. */
const dark: Palette = {
  scheme: 'dark',
  bg: '#1A1613',
  bgTop: '#2C221B',
  surface: '#241E1A',
  surfaceAlt: '#2B2420',
  sunken: '#1E1916',
  ink: '#F5EEE6',
  inkSoft: '#C9BCB0',
  inkFaint: '#8F8277',
  line: '#3A312A',
  primary: '#8DBF9C',
  primaryPressed: '#7DB08C',
  primaryInk: '#13201A',
  primarySoft: '#24372B',
  lavender: '#AFA2EA',
  lavenderSoft: '#2C2838',
  peach: '#F0A07F',
  peachSoft: '#3B2820',
  sage: '#86BE95',
  sageSoft: '#22332A',
  sky: '#86B6DA',
  skySoft: '#1F2C36',
  butter: '#E6C068',
  butterSoft: '#382F1C',
  rose: '#EA9C9C',
  roseSoft: '#3A2425',
  danger: '#F08A72',
  dangerSoft: '#3D211B',
  success: '#7CC795',
  overlay: 'rgba(0, 0, 0, 0.55)',
  shadow: '#000000',
  frame: '#100D0B',
};

export type Accent = 'lavender' | 'peach' | 'sage' | 'sky' | 'butter' | 'rose';

export function accent(c: Palette, name: Accent) {
  return { strong: c[name], soft: c[`${name}Soft` as const] };
}

/** Mood scale: 1 = very low … 5 = great. */
export const MOODS = [
  { value: 1, label: 'Very low', accent: 'sky' as Accent },
  { value: 2, label: 'Low', accent: 'lavender' as Accent },
  { value: 3, label: 'Okay', accent: 'butter' as Accent },
  { value: 4, label: 'Good', accent: 'sage' as Accent },
  { value: 5, label: 'Great', accent: 'peach' as Accent },
] as const;

/**
 * Light through the window, by time of day: the top of a screen's gradient.
 * Morning apricot, afternoon honey, evening rose, night lavender.
 */
export function daylight(c: Palette, date = new Date()): string {
  const h = date.getHours();
  const slot = h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 21 ? 2 : 3;
  const lightTops = ['#FBE1CC', '#FAEDC8', '#F7DDD6', '#E6E2F2'];
  const darkTops = ['#3A281D', '#36301C', '#3A2524', '#26233A'];
  return (c.scheme === 'dark' ? darkTops : lightTops)[slot]!;
}

/**
 * Newsreader (a calm, book-like serif) for headings and quotes, and Figtree (warm
 * and clear) for everything else: closer to a well-made journal than a toy.
 */
export const fonts = {
  display: 'Newsreader_600SemiBold',
  displaySoft: 'Newsreader_500Medium',
  quote: 'Newsreader_500Medium_Italic',
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  bold: 'Figtree_600SemiBold',
  heavy: 'Figtree_700Bold',
};

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.displaySoft, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  subheading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  quote: { fontFamily: fonts.quote, fontSize: 24, lineHeight: 32, letterSpacing: -0.2 },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };

export function shadow(c: Palette, level: 1 | 2 | 3 = 1): ViewStyle {
  if (c.scheme === 'dark') return { borderWidth: 1, borderColor: c.line };
  const opacity = [0, 0.07, 0.1, 0.15][level]!;
  const blur = [0, 14, 22, 32][level]!;
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${level * 3}px ${blur}px rgba(122, 92, 68, ${opacity})` } as ViewStyle,
    default: {
      shadowColor: c.shadow,
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
      shadowOffset: { width: 0, height: level * 3 },
      elevation: level * 2,
    },
  })!;
}

/** The active palette: light by default, dark or the phone's setting if chosen in Settings. */
export function useTheme(): Palette {
  const { mode } = useContext(ThemeModeContext);
  const system = useColorScheme();
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  return scheme === 'dark' ? dark : light;
}

export const palettes = { light, dark };
export { ThemeModeProvider, useThemeMode, type ThemeMode } from './mode';
