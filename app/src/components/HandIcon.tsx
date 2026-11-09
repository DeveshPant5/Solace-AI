import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import Svg, { G, Path } from 'react-native-svg';

/**
 * Solace's own icons, drawn to feel made by hand rather than picked from a set:
 * strokes are slightly uneven, and a soft wash of colour sits a little off the
 * line, like a pencil drawing coloured in with watercolour. Icons without a
 * drawing here fall back to Feather, so nothing ever goes missing.
 *
 * Every glyph is drawn on a 24 x 24 grid: `lines` are stroked, `wash` is filled
 * softly behind them, `dots` are filled solid.
 */
type Glyph = { lines: string[]; wash?: string[]; dots?: string[] };

const CLOUD_HIGH =
  'M7.4 15.4h10.1c2.2 0 3.9-1.6 3.9-3.6 0-1.9-1.5-3.5-3.5-3.7-.4-2.7-2.9-4.8-5.8-4.8-2.6 0-4.8 1.6-5.6 3.9-2 .3-3.5 1.9-3.5 3.9 0 2.4 2 4.3 4.4 4.3z';
const BELL =
  'M5.4 16.8c.9-1 1.3-2.4 1.3-3.8v-2.1c0-3 2.4-5.4 5.3-5.4s5.3 2.4 5.3 5.4V13c0 1.4.4 2.8 1.3 3.8z';
const FLAME =
  'M12.4 3.3c.5 3-1.9 4.5-3.3 6.4-1.4 1.9-1.9 4.4-.7 6.6 1.1 2 3.4 3 5.5 2.6 2.9-.6 4.6-3.4 3.9-6.3-.4-1.8-1.5-3.1-2.5-4.4 0 1.6-.5 2.8-1.6 3.4.3-3.2-.4-6.1-1.3-8.3z';
const BUBBLE =
  'M5.5 16.4C4 15.1 3.1 13.4 3.1 11.6c0-4 4-7.2 8.9-7.2s8.9 3.2 8.9 7.2-4 7.1-8.9 7.1c-1.2 0-2.4-.2-3.5-.5l-4 1.4 1-3.2z';
/** A circle at (cx, cy) as a path. */
const CIRCLE = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}z`;
const RING = (r: number) => `M12 ${12 - r}c${(r * 0.55).toFixed(2)} 0 ${r} ${(r * 0.45).toFixed(2)} ${r} ${r}s${-(r * 0.45).toFixed(2)} ${r} ${-r} ${r}-${r}-${(r * 0.45).toFixed(2)}-${r}-${r} ${(r * 0.45).toFixed(2)}-${r} ${r}-${r}z`;

const GLYPHS: Record<string, Glyph> = {
  heart: {
    wash: ['M12 20c-3-2-8-5.4-8.4-9.7C3.3 7.4 5.3 5.2 7.9 5.3c1.9.1 3.2 1.3 4.1 2.8.9-1.5 2.3-2.8 4.2-2.8 2.6 0 4.5 2.3 4.1 5.2C19.8 14.7 15 18 12 20z'],
    lines: ['M12 19.6c-.6-.4-7.6-4.6-8.2-9.3-.4-3 1.5-5.2 4.1-5.1 1.9.1 3.2 1.4 4.1 2.9.9-1.6 2.3-2.9 4.2-2.9 2.6.1 4.5 2.4 4 5.3-.7 4.5-7.6 8.7-8.2 9.1z'],
  },
  wind: {
    wash: ['M5 10.5c3-2 10-2.5 13-1s2.5 6-1 7S7 17.5 5 15.5 2.6 12 5 10.5z'],
    lines: [
      'M3.4 9.3c3.4 0 7.3-.1 9.9-.3 2.6-.2 3.6-2.7 2.1-4-1.3-1.1-3.3-.4-3.4 1.2',
      'M3.2 13.2c4.4.1 9.9 0 13.4.1 2.5.1 3.6 2.8 2 4.2-1.4 1.2-3.5.4-3.6-1.3',
      'M5 17.1c1.6 0 3.5-.1 5.1-.1',
    ],
  },
  moon: {
    wash: ['M14.6 3.7a8.4 8.4 0 1 0 5.9 12.9 6.8 6.8 0 0 1-5.9-12.9z'],
    lines: ['M14.4 3.5A8.5 8.5 0 1 0 20.7 16.8 6.8 6.8 0 0 1 14.4 3.5z'],
    dots: ['M18.6 4.9l.4 1.1 1.1.4-1.1.4-.4 1.1-.4-1.1-1.1-.4 1.1-.4z'],
  },
  sun: {
    wash: ['M12 7.6c2.5 0 4.4 2 4.4 4.4s-2 4.5-4.5 4.4c-2.4 0-4.3-2-4.3-4.5 0-2.4 2-4.3 4.4-4.3z'],
    lines: [
      'M12 8c2.3 0 4.1 1.8 4.1 4.1 0 2.2-1.9 4-4.2 4-2.2 0-4-1.9-4-4.1C7.9 9.8 9.7 8 12 8z',
      'M12 2.8v2.1', 'M12.1 19.2v2', 'M2.9 12.1h2', 'M19.1 12h2',
      'M5.5 5.6l1.4 1.4', 'M17.1 17l1.5 1.5', 'M18.5 5.5l-1.4 1.5', 'M6.9 17.1l-1.4 1.4',
    ],
  },
  sunrise: {
    wash: ['M7 18c0-3.2 2.3-5.2 5-5.2s5 2 5 5.2z'],
    lines: [
      'M3 18.3c5.9-.2 12-.1 18 0',
      'M7.6 18c0-2.6 2-4.6 4.4-4.6s4.4 2 4.4 4.6',
      'M12 4.6v5.2', 'M9.8 6.8L12 4.6l2.2 2.2',
      'M4.7 12.8l1.5 1.1', 'M19.3 12.8l-1.5 1.1',
    ],
  },
  'message-circle': {
    wash: [BUBBLE],
    lines: [BUBBLE, 'M8.3 10.4c2.4-.1 5-.1 7.4 0', 'M8.3 13.2c1.6 0 3.2 0 4.6-.1'],
  },
  feather: {
    wash: ['M19.6 4.4c-6 .4-10.6 4.5-11.9 10.3l-.6 2.6c6.2-.2 11.3-5.6 12.5-12.9z'],
    lines: [
      'M19.7 4.3c-5.9.6-10.5 4.7-11.8 10.4l-.8 3.2',
      'M19.7 4.3c.4 5.6-3.7 10.8-10.1 11.4',
      'M9.2 12.6l4.8-.4',
      'M4.3 20.4l2.6-2.7',
    ],
  },
  'book-open': {
    wash: ['M3.5 6.3c2.9-.8 5.9-.5 8.5 1.2 2.6-1.7 5.6-2 8.5-1.2v11.4c-2.9-.8-5.9-.4-8.5 1.2-2.6-1.6-5.6-2-8.5-1.2z'],
    lines: [
      'M12 7.4c-2.6-1.7-5.6-2-8.5-1.2v11.5c2.9-.8 5.9-.4 8.5 1.2',
      'M12 7.4c2.6-1.7 5.6-2 8.5-1.2v11.5c-2.9-.8-5.9-.4-8.5 1.2',
      'M12 7.4v11.5',
    ],
  },
  bookmark: {
    wash: ['M7.3 4h9.4c.5 0 .8.3.8.8V20l-5.5-3.6L6.5 20V4.8c0-.5.3-.8.8-.8z'],
    lines: ['M7.2 3.8h9.5c.5 0 .9.4.9.9v15.5l-5.6-3.7-5.7 3.7V4.7c0-.5.4-.9.9-.9z'],
  },
  bell: {
    wash: [BELL],
    lines: [BELL, 'M10.2 19.4c.4.7 1 1.1 1.8 1.1s1.4-.4 1.8-1.1', 'M12 3.6v1.9'],
  },
  'bell-off': {
    wash: [BELL],
    lines: [BELL, 'M10.2 19.4c.4.7 1 1.1 1.8 1.1s1.4-.4 1.8-1.1', 'M12 3.6v1.9', 'M4.2 4.4l15.6 15.4'],
  },
  sliders: {
    wash: ['M15.2 5.2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M9.2 10.1a2 2 0 1 1 0 4 2 2 0 0 1 0-4z', 'M17 15a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
    lines: [
      'M4 7.2h9.3', 'M17 7.3h3', 'M4 12.1h3.4', 'M11 12.2h9', 'M4 17h11.2', 'M18.8 17.1H20',
      'M15.2 5.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z',
      'M9.2 10.3a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z',
      'M17 15.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z',
    ],
  },
  'life-buoy': {
    wash: [RING(8.6)],
    lines: [RING(8.6), RING(3.7), 'M6 6l3.4 3.4', 'M14.6 14.6L18 18', 'M18 6l-3.4 3.4', 'M9.4 14.6L6 18'],
  },
  compass: {
    wash: ['M15.6 8.4l-2.2 5-5 2.2 2.2-5z'],
    lines: [RING(8.7), 'M15.6 8.4l-2.2 5-5 2.2 2.2-5z'],
  },
  zap: { wash: [FLAME], lines: [FLAME] },
  'zap-off': { wash: [FLAME], lines: [FLAME, 'M4.4 4.4l15.2 15.2'] },
  award: {
    wash: ['M12 3.5c3.1 0 5.6 2.5 5.6 5.6s-2.5 5.6-5.6 5.6-5.6-2.5-5.6-5.6S8.9 3.5 12 3.5z'],
    lines: ['M12 3.5c3.1 0 5.6 2.5 5.6 5.6s-2.5 5.6-5.6 5.6-5.6-2.5-5.6-5.6S8.9 3.5 12 3.5z', 'M9 13.9L7.6 20.6l4.4-2.3 4.3 2.3-1.4-6.7'],
  },
  anchor: {
    lines: [
      'M12 7.6v13',
      'M12 3.3c1.2 0 2.2 1 2.2 2.2S13.2 7.6 12 7.6s-2.2-.9-2.2-2.1 1-2.2 2.2-2.2z',
      'M8.4 10.6h7.2',
      'M4.6 13.4c.4 4.1 3.6 7.2 7.4 7.2s7-3.1 7.4-7.2',
      'M3.4 14.8l1.2-1.6 1.7 1.2', 'M20.6 14.8l-1.2-1.6-1.7 1.2',
    ],
  },
  users: {
    wash: ['M3.6 19.4c.4-3.2 2.7-5.4 5.4-5.4s5 2.2 5.4 5.4z'],
    lines: [
      'M9 4.6c1.7 0 3 1.4 3 3.1s-1.3 3-3 3-3-1.3-3-3 1.3-3.1 3-3.1z',
      'M3.6 19.4c.4-3.2 2.7-5.4 5.4-5.4s5 2.2 5.4 5.4',
      'M16.2 5.6c1.4 0 2.5 1.1 2.5 2.6s-1.1 2.5-2.5 2.5',
      'M17.4 14.2c1.8.6 3 2.4 3.1 4.9',
    ],
  },
  cloud: {
    wash: ['M7.4 18.3h10.1c2.2 0 3.9-1.7 3.9-3.8 0-2-1.5-3.7-3.5-3.9-.4-2.9-2.9-5.1-5.8-5.1-2.6 0-4.8 1.7-5.6 4.1-2 .3-3.5 2-3.5 4.1 0 2.5 2 4.6 4.4 4.6z'],
    lines: ['M7.4 18.3h10.1c2.2 0 3.9-1.7 3.9-3.8 0-2-1.5-3.7-3.5-3.9-.4-2.9-2.9-5.1-5.8-5.1-2.6 0-4.8 1.7-5.6 4.1-2 .3-3.5 2-3.5 4.1 0 2.5 2 4.6 4.4 4.6z'],
  },
  'cloud-rain': { wash: [CLOUD_HIGH], lines: [CLOUD_HIGH, 'M8.4 18.4l-.9 2.2', 'M12.4 18.4l-.9 2.2', 'M16.4 18.4l-.9 2.2'] },
  'cloud-drizzle': {
    wash: [CLOUD_HIGH],
    lines: [CLOUD_HIGH],
    dots: ['M8.2 18.6a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z', 'M12.2 19.6a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z', 'M16.2 18.6a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z'],
  },
  target: {
    wash: [RING(5.2)],
    lines: [RING(8.6), RING(5.2)],
    dots: ['M12 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z'],
  },
  square: {
    wash: ['M6.4 4.4h11.2c1.1 0 2 .9 2 2v11.2c0 1.1-.9 2-2 2H6.4c-1.1 0-2-.9-2-2V6.4c0-1.1.9-2 2-2z'],
    lines: ['M6.5 4.3h11.2c1.1 0 2 .9 2 2.1v11.1c0 1.1-.9 2.1-2 2.1H6.4c-1.1 0-2-.9-2-2V6.4c0-1.2.9-2.1 2.1-2.1z'],
    dots: ['M8.4 6.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z'],
  },
  smile: {
    wash: [RING(8.6)],
    lines: [RING(8.6), 'M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.7-.7 3.5-2'],
    dots: ['M9.2 9a1 1 0 1 1 0 2 1 1 0 0 1 0-2z', 'M14.8 9a1 1 0 1 1 0 2 1 1 0 0 1 0-2z'],
  },
  repeat: {
    lines: [
      'M17.4 3.8l2.4 2.4-2.4 2.4', 'M4.4 11.4V10c0-2.1 1.7-3.8 3.8-3.8h11.4',
      'M6.6 20.2l-2.4-2.4 2.4-2.4', 'M19.6 12.6V14c0 2.1-1.7 3.8-3.8 3.8H4.4',
    ],
  },
  link: {
    lines: [
      'M10.2 13.8a3.9 3.9 0 0 0 5.6.2l2.8-2.8a3.9 3.9 0 0 0-5.5-5.5l-1.4 1.4',
      'M13.8 10.2a3.9 3.9 0 0 0-5.6-.2l-2.8 2.8a3.9 3.9 0 0 0 5.5 5.5l1.4-1.4',
    ],
  },
  'map-pin': {
    wash: ['M12 21s-6.6-5.6-6.6-11A6.6 6.6 0 0 1 12 3.4 6.6 6.6 0 0 1 18.6 10c0 5.4-6.6 11-6.6 11z'],
    lines: [
      'M12 21s-6.6-5.6-6.6-11A6.6 6.6 0 0 1 12 3.4 6.6 6.6 0 0 1 18.6 10c0 5.4-6.6 11-6.6 11z',
      'M12 7.6c1.3 0 2.4 1.1 2.4 2.4S13.3 12.4 12 12.4 9.6 11.3 9.6 10 10.7 7.6 12 7.6z',
    ],
  },
  coffee: {
    wash: ['M5 9.6h11.2v5.2c0 2.6-2.1 4.7-4.7 4.7H9.7C7.1 19.5 5 17.4 5 14.8z'],
    lines: [
      'M5 9.6h11.2v5.2c0 2.6-2.1 4.7-4.7 4.7H9.7C7.1 19.5 5 17.4 5 14.8z',
      'M16.2 11h1.4c1.4 0 2.4 1.1 2.4 2.4s-1.1 2.4-2.4 2.4h-1.6',
      'M8.4 3.6c-.6.8-.6 1.7 0 2.5', 'M11.6 3.6c-.6.8-.6 1.7 0 2.5',
    ],
  },
  clipboard: {
    wash: ['M6.6 4.6h10.8c.9 0 1.6.7 1.6 1.6v13.2c0 .9-.7 1.6-1.6 1.6H6.6c-.9 0-1.6-.7-1.6-1.6V6.2c0-.9.7-1.6 1.6-1.6z'],
    lines: [
      'M8.2 4.6H6.6c-.9 0-1.6.7-1.6 1.6v13.2c0 .9.7 1.6 1.6 1.6h10.8c.9 0 1.6-.7 1.6-1.6V6.2c0-.9-.7-1.6-1.6-1.6h-1.6',
      'M9.2 3.4h5.6c.4 0 .8.4.8.8v1.4c0 .4-.4.8-.8.8H9.2c-.4 0-.8-.4-.8-.8V4.2c0-.4.4-.8.8-.8z',
      'M8.8 13.4l2.2 2.2 4.2-4.4',
    ],
  },
  phone: {
    lines: [
      'M20.6 16.4v2.6c0 1-.8 1.8-1.8 1.7-8.3-.6-14.9-7.2-15.5-15.5C3.2 4.2 4 3.4 5 3.4h2.6c.8 0 1.6.6 1.7 1.4.1 1 .4 2 .8 2.9.2.6.1 1.3-.4 1.8l-1.1 1.1c1.2 2.2 3 4 5.2 5.2l1.1-1.1c.5-.5 1.2-.6 1.8-.4.9.4 1.9.7 2.9.8.8.1 1.4.9 1.4 1.7z',
    ],
  },
  globe: {
    wash: [RING(8.6)],
    lines: [RING(8.6), 'M3.4 12h17.2', 'M12 3.4c2.2 2.4 3.3 5.3 3.3 8.6s-1.1 6.2-3.3 8.6c-2.2-2.4-3.3-5.3-3.3-8.6S9.8 5.8 12 3.4z'],
  },
  eye: {
    wash: ['M12 9.2c1.6 0 2.8 1.2 2.8 2.8s-1.2 2.8-2.8 2.8-2.8-1.2-2.8-2.8 1.2-2.8 2.8-2.8z'],
    lines: [
      'M2.8 12s3.4-6.4 9.2-6.4 9.2 6.4 9.2 6.4-3.4 6.4-9.2 6.4S2.8 12 2.8 12z',
      'M12 9.2c1.6 0 2.8 1.2 2.8 2.8s-1.2 2.8-2.8 2.8-2.8-1.2-2.8-2.8 1.2-2.8 2.8-2.8z',
    ],
  },
  smartphone: {
    wash: ['M8 2.8h8c1.1 0 1.9.8 1.9 1.9v14.6c0 1.1-.8 1.9-1.9 1.9H8c-1.1 0-1.9-.8-1.9-1.9V4.7c0-1.1.8-1.9 1.9-1.9z'],
    lines: ['M8 2.8h8c1.1 0 1.9.8 1.9 1.9v14.6c0 1.1-.8 1.9-1.9 1.9H8c-1.1 0-1.9-.8-1.9-1.9V4.7c0-1.1.8-1.9 1.9-1.9z', 'M11 17.8h2'],
  },

  hand: {
    wash: ['M8 14.2V6.6c0-.8.6-1.4 1.4-1.4h7.4c.8 0 1.4.6 1.4 1.4l1 6.8c0 4-2.9 7.2-6.6 7.2-2.4 0-4.2-1.1-5.4-3.1z'],
    lines: [
      'M8 12.2V6.6c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v4.6',
      'M10.8 10.6V4.8c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v5.8',
      'M13.6 10.8V6c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v5.4',
      'M16.4 11.2V8.6c0-.8.6-1.4 1.4-1.4s1.4.6 1.4 1.4v4.8c0 4-2.9 7.2-6.6 7.2-2.4 0-4.2-1.1-5.4-3.1l-2.4-4c-.4-.7-.2-1.5.5-1.9.6-.4 1.4-.2 1.9.4L8 14.2',
    ],
  },
  ear: {
    wash: ['M7.6 9.4c0-3.2 2.3-5.6 5.2-5.6s5.2 2.4 5.2 5.4c0 2.2-1.2 3.4-2.4 4.4-1 .8-1.4 1.6-1.6 2.8-.3 2.4-1.9 3.8-3.9 3.8-1.6 0-2.9-.9-3.4-2.3z'],
    lines: [
      'M7.6 9.4c0-3.2 2.3-5.6 5.2-5.6s5.2 2.4 5.2 5.4c0 2.2-1.2 3.4-2.4 4.4-1 .8-1.4 1.6-1.6 2.8-.3 2.4-1.9 3.8-3.9 3.8-1.6 0-2.9-.9-3.4-2.3',
      'M10.4 9.6c0-1.4 1-2.5 2.4-2.5s2.4 1.1 2.4 2.4c0 1.1-.7 1.6-1.4 2.1',
    ],
  },
  flower: {
    wash: [CIRCLE(12, 6.1, 2), CIRCLE(15.7, 8.8, 2), CIRCLE(14.3, 13.1, 2), CIRCLE(9.7, 13.1, 2), CIRCLE(8.3, 8.8, 2)],
    lines: [
      CIRCLE(12, 6.1, 2), CIRCLE(15.7, 8.8, 2), CIRCLE(14.3, 13.1, 2), CIRCLE(9.7, 13.1, 2), CIRCLE(8.3, 8.8, 2),
      'M12 15.2c0 2.2-.2 4 0 5.8',
      'M12 18.2c1.6-1.6 3.4-2 5-1.6-1 1.8-2.8 2.4-5 1.6z',
    ],
    dots: [CIRCLE(12, 10, 1.3)],
  },

  // ---- Drawings for the achievement patches ----
  sprout: {
    wash: ['M11.6 12.4c-.4-3.2-2.8-5.2-6.2-5.1.2 3.2 2.7 5.4 6.2 5.1z', 'M11.7 10.6c.6-3.4 3.2-5.6 6.9-5.4-.3 3.5-3.1 5.7-6.9 5.4z'],
    lines: [
      'M12 20.4c0-3.6-.3-6.7-.4-9',
      'M11.6 12.4c-.4-3.2-2.8-5.2-6.2-5.1.2 3.2 2.7 5.4 6.2 5.1z',
      'M11.7 10.6c.6-3.4 3.2-5.6 6.9-5.4-.3 3.5-3.1 5.7-6.9 5.4z',
      'M6.8 20.6c3.4-.4 7-.4 10.4 0',
    ],
  },
  growing: {
    wash: [
      'M6.5 16.8c-1.6-.1-2.6-1-2.8-2.4 1.5 0 2.6.9 2.8 2.4z',
      'M12 15.2c-1.9-.1-3.1-1.2-3.3-2.9 1.8 0 3.1 1.1 3.3 2.9z', 'M12 14.2c.3-1.8 1.6-2.9 3.4-2.9-.3 1.7-1.6 2.8-3.4 2.9z',
      'M17.5 13c-2-.1-3.3-1.3-3.5-3.1 1.9 0 3.3 1.2 3.5 3.1z', 'M17.5 11.6c.3-1.9 1.7-3.1 3.6-3.1-.3 1.8-1.7 3-3.6 3.1z',
    ],
    lines: [
      'M3.5 19.6c5.6-.3 11.4-.3 17 0',
      'M6.5 19.4v-3', 'M6.5 16.8c-1.6-.1-2.6-1-2.8-2.4 1.5 0 2.6.9 2.8 2.4z',
      'M12 19.4v-6', 'M12 15.2c-1.9-.1-3.1-1.2-3.3-2.9 1.8 0 3.1 1.1 3.3 2.9z', 'M12 14.2c.3-1.8 1.6-2.9 3.4-2.9-.3 1.7-1.6 2.8-3.4 2.9z',
      'M17.5 19.4v-9.4', 'M17.5 13c-2-.1-3.3-1.3-3.5-3.1 1.9 0 3.3 1.2 3.5 3.1z', 'M17.5 11.6c.3-1.9 1.7-3.1 3.6-3.1-.3 1.8-1.7 3-3.6 3.1z',
    ],
  },
  footprints: {
    wash: [
      'M8.6 4.4c1.6 0 2.6 1.9 2.4 4.3-.2 2.2-1 3.6-2.5 3.6S6 10.9 6 8.7c0-2.4 1-4.3 2.6-4.3z',
      'M15.4 8.4c1.6 0 2.6 1.9 2.4 4.3-.2 2.2-1 3.6-2.5 3.6s-2.5-1.4-2.5-3.6c0-2.4 1-4.3 2.6-4.3z',
    ],
    lines: [
      'M8.6 4.4c1.6 0 2.6 1.9 2.4 4.3-.2 2.2-1 3.6-2.5 3.6S6 10.9 6 8.7c0-2.4 1-4.3 2.6-4.3z',
      'M7 13.6c.5 1.6 1.2 2.6 2.4 2.4 1.1-.2 1.4-1.4 1.1-2.9',
      'M15.4 8.4c1.6 0 2.6 1.9 2.4 4.3-.2 2.2-1 3.6-2.5 3.6s-2.5-1.4-2.5-3.6c0-2.4 1-4.3 2.6-4.3z',
      'M13.8 17.6c.5 1.6 1.2 2.6 2.4 2.4 1.1-.2 1.4-1.4 1.1-2.9',
    ],
  },
  notebook: {
    wash: ['M6.4 3.6h10.2c.9 0 1.6.7 1.6 1.6v14c0 .9-.7 1.6-1.6 1.6H6.4z'],
    lines: [
      'M6.4 3.6h10.2c.9 0 1.6.7 1.6 1.6v14c0 .9-.7 1.6-1.6 1.6H6.4z',
      'M6.4 7.2H4.6', 'M6.4 12H4.6', 'M6.4 16.8H4.6',
      'M9.6 8.4h5.6', 'M9.6 11.6h5.6', 'M9.6 14.8h3.4',
    ],
  },
  'chat-heart': {
    wash: [BUBBLE],
    lines: [BUBBLE],
    dots: ['M12 14.6c-.3-.2-3-1.9-3.3-3.6-.2-1.2.6-2.1 1.6-2 .7 0 1.2.5 1.7 1.1.4-.6.9-1.1 1.7-1.1 1 0 1.8.9 1.6 2.1-.3 1.7-3 3.3-3.3 3.5z'],
  },
};

/** Irregular, hand-cut shapes for icon backgrounds; each icon gets one, slightly turned. */
const BLOBS = [
  'M11.2 1.9c4.6-.4 9.6 1.9 10.6 7.4.9 5-1.3 11.3-7.6 12.6-5.6 1.2-11.2-1.6-12.3-7.3C.8 9 5.2 2.4 11.2 1.9z',
  'M12.8 1.6c5.6.6 9.4 4.8 9.3 10.4-.1 5.2-3.7 10.4-10.1 10.4-5.8 0-10-3.6-10.4-9.2C1.2 7.4 6.4 1 12.8 1.6z',
  'M10.6 2.2c5.2-1.4 10.8 1 11.6 6.8.8 5.6-2.4 12.4-9.4 12.8-5.6.3-10.6-3.3-11.1-8.9C1.3 8 5.4 3.6 10.6 2.2z',
  'M12.2 1.8c4.8.2 8.7 2.6 9.8 7.6 1.2 5.6-1.8 11.6-8.2 12.6-6.2 1-11.4-2.6-12-8.4-.6-6.2 4-12 10.4-11.8z',
];

function hash(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const hasHandIcon = (name: string) => name in GLYPHS;

function GlyphPaths({
  glyph,
  color,
  wash,
  strokeWidth,
  sketch = false,
}: {
  glyph: Glyph;
  color: string;
  wash: boolean;
  strokeWidth: number;
  /** A faint second pencil line just off the first, like a quick hand sketch. */
  sketch?: boolean;
}) {
  return (
    <>
      {wash &&
        glyph.wash?.map((d, i) => (
          // The colour sits a little off the line, as if coloured in by hand.
          <Path key={`w${i}`} d={d} fill={color} opacity={0.22} transform="translate(0.7 0.9)" />
        ))}
      {sketch &&
        glyph.lines.map((d, i) => (
          <Path
            key={`s${i}`}
            d={d}
            fill="none"
            stroke={color}
            strokeOpacity={0.28}
            strokeWidth={strokeWidth * 0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(0.5 -0.35) rotate(0.8 12 12)"
          />
        ))}
      {glyph.lines.map((d, i) => (
        <Path key={`l${i}`} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {glyph.dots?.map((d, i) => (
        <Path key={`d${i}`} d={d} fill={color} />
      ))}
    </>
  );
}

type FeatherName = ComponentProps<typeof Feather>['name'];

/** A hand-drawn icon on its own (for chips, rows and buttons). */
export function HandIcon({ name, size = 20, color, wash = true }: { name: string; size?: number; color: string; wash?: boolean }) {
  const glyph = GLYPHS[name];
  if (!glyph) return <Feather name={name as FeatherName} size={size * 0.9} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <GlyphPaths glyph={glyph} color={color} wash={wash} strokeWidth={1.7} />
    </Svg>
  );
}

/** A hand-drawn icon on a soft, irregular patch of colour. */
export function HandIconTile({ name, size = 40, bg, fg }: { name: string; size?: number; bg: string; fg: string }) {
  const glyph = GLYPHS[name];
  const h = hash(name);
  const blob = BLOBS[h % BLOBS.length]!;
  const tilt = (h % 13) - 6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={blob} fill={bg} transform={`rotate(${tilt} 12 12)`} />
      {glyph ? (
        <G transform="translate(4.8 4.8) scale(0.6)">
          <GlyphPaths glyph={glyph} color={fg} wash sketch strokeWidth={2} />
        </G>
      ) : null}
    </Svg>
  );
}

/**
 * An achievement as a small embroidered patch: a hand-cut shape with a stitched
 * edge and a drawing in the middle. Patches not earned yet are pale, unstitched outlines.
 */
export function PatchBadge({ name, size = 52, earned, bg, fg }: { name: string; size?: number; earned: boolean; bg: string; fg: string }) {
  const glyph = GLYPHS[name] ?? GLYPHS.award!;
  const h = hash(name);
  const blob = BLOBS[h % BLOBS.length]!;
  const tilt = (h % 9) - 4;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G transform={`rotate(${tilt} 12 12)`}>
        <Path d={blob} fill={bg} />
        <Path
          d={RING(9.1)}
          fill="none"
          stroke={fg}
          strokeOpacity={earned ? 0.55 : 0.35}
          strokeWidth={0.55}
          strokeDasharray={earned ? '1.1 0.9' : '0.4 1.4'}
          strokeLinecap="round"
        />
      </G>
      <G transform="translate(5.4 5.4) scale(0.55)">
        <GlyphPaths glyph={glyph} color={fg} wash={earned} sketch={earned} strokeWidth={2.1} />
      </G>
    </Svg>
  );
}
