import { useEffect, useId, useState, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { useSolLook, type CheekChoice, type FlowerId, type GlassesChoice, type SolLook } from '@/lib/solLook';

export type SolMood = 'happy' | 'calm' | 'listening' | 'concerned' | 'joyful' | 'sleepy' | 'thinking';

/** Luma's colours shift gently with the person's mood (1 = very low … 5 = great). */
const TINTS: Record<number, [string, string, string]> = {
  0: ['#FFC2A8', '#C9B8FF', '#9CCBF5'],
  1: ['#B9C9F2', '#A9B6EC', '#8FB2E8'],
  2: ['#D4C4FF', '#B7A6F7', '#A3B9F2'],
  3: ['#FFE2A0', '#F9C9A0', '#D8C2F5'],
  4: ['#BFE8C9', '#9DD6C0', '#A8CFF0'],
  5: ['#FFD08F', '#FFAE95', '#F6A2C4'],
};

export function moodToExpression(mood: number | null | undefined): SolMood {
  switch (mood) {
    case 1:
      return 'concerned';
    case 2:
      return 'listening';
    case 3:
      return 'calm';
    case 4:
      return 'happy';
    case 5:
      return 'joyful';
    default:
      return 'happy';
  }
}

const INK = '#2A2340';
const stroke = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

type EyeStyle = 'round' | 'big' | 'happy' | 'sleepy' | 'angry' | 'worried' | 'wink' | 'hearts' | 'stars' | 'thinking';
type MouthStyle = 'smile' | 'grin' | 'soft' | 'listen' | 'frown' | 'small' | 'smirk' | 'tongue' | 'cat' | 'open' | 'flat' | 'grumpy';

/** Luma's own eyes for each mood (what "As Luma feels" means). */
function moodEyes(mood: SolMood): EyeStyle {
  if (mood === 'calm' || mood === 'joyful') return 'happy';
  if (mood === 'sleepy') return 'sleepy';
  if (mood === 'concerned') return 'worried';
  if (mood === 'thinking') return 'thinking';
  return 'round';
}

const MOOD_MOUTH: Record<SolMood, MouthStyle> = {
  joyful: 'grin',
  happy: 'smile',
  calm: 'soft',
  listening: 'listen',
  concerned: 'frown',
  sleepy: 'small',
  thinking: 'smirk',
};

const heart = (x: number, y: number) =>
  `M${x} ${y + 7}C${x - 2} ${y + 5} ${x - 9} ${y} ${x - 9} ${y - 4}C${x - 9} ${y - 8} ${x - 5} ${y - 10} ${x - 2.5} ${y - 10}C${x - 1} ${y - 10} ${x} ${y - 9} ${x} ${y - 7}C${x} ${y - 9} ${x + 1} ${y - 10} ${x + 2.5} ${y - 10}C${x + 5} ${y - 10} ${x + 9} ${y - 8} ${x + 9} ${y - 4}C${x + 9} ${y} ${x + 2} ${y + 5} ${x} ${y + 7}Z`;
const sparkle = (x: number, y: number) =>
  `M${x} ${y - 10}Q${x + 1.8} ${y - 1.8} ${x + 10} ${y}Q${x + 1.8} ${y + 1.8} ${x} ${y + 10}Q${x - 1.8} ${y + 1.8} ${x - 10} ${y}Q${x - 1.8} ${y - 1.8} ${x} ${y - 10}Z`;

function Dots({ ry, rx = 6.5, cy = 107, shine = true }: { ry: number; rx?: number; cy?: number; shine?: boolean }) {
  return (
    <G>
      <Ellipse cx={78} cy={cy} rx={rx} ry={ry} fill={INK} />
      <Ellipse cx={122} cy={cy} rx={rx} ry={ry} fill={INK} />
      {shine && ry > 2 && (
        <G>
          <Circle cx={80.5} cy={cy - 3.5} r={2.2} fill="#FFFFFF" />
          <Circle cx={124.5} cy={cy - 3.5} r={2.2} fill="#FFFFFF" />
        </G>
      )}
    </G>
  );
}

function Eyes({ style, blink }: { style: EyeStyle; blink: boolean }) {
  const open = blink ? 1.2 : 8;
  switch (style) {
    case 'happy':
      return (
        <G>
          <Path d="M69 108 Q78 99 87 108" {...stroke} />
          <Path d="M113 108 Q122 99 131 108" {...stroke} />
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Path d="M69 106 Q78 113 87 106" {...stroke} />
          <Path d="M113 106 Q122 113 131 106" {...stroke} />
        </G>
      );
    case 'worried':
      return (
        <G>
          <Dots ry={open} />
          <Path d="M68 92 Q76 88 85 92" {...stroke} strokeWidth={3.5} />
          <Path d="M115 92 Q124 88 132 92" {...stroke} strokeWidth={3.5} />
        </G>
      );
    case 'thinking':
      return (
        <G>
          <Dots ry={open} />
          <Path d="M114 90 Q123 85 132 89" {...stroke} strokeWidth={3.5} />
        </G>
      );
    case 'angry':
      return (
        <G>
          <Dots ry={blink ? 1.2 : 6.5} cy={108} />
          <Path d="M66 91 L87 99" {...stroke} />
          <Path d="M134 91 L113 99" {...stroke} />
        </G>
      );
    case 'big':
      return (
        <G>
          <Ellipse cx={78} cy={106} rx={9} ry={blink ? 1.2 : 11} fill={INK} />
          <Ellipse cx={122} cy={106} rx={9} ry={blink ? 1.2 : 11} fill={INK} />
          {!blink && (
            <G>
              <Circle cx={81.5} cy={101} r={3.4} fill="#FFFFFF" />
              <Circle cx={125.5} cy={101} r={3.4} fill="#FFFFFF" />
              <Circle cx={75} cy={111} r={1.6} fill="#FFFFFF" />
              <Circle cx={119} cy={111} r={1.6} fill="#FFFFFF" />
            </G>
          )}
        </G>
      );
    case 'wink':
      return (
        <G>
          <Path d="M69 108 Q78 99 87 108" {...stroke} />
          <Ellipse cx={122} cy={107} rx={6.5} ry={8} fill={INK} />
          <Circle cx={124.5} cy={103.5} r={2.2} fill="#FFFFFF" />
        </G>
      );
    case 'hearts':
      return (
        <G>
          <Path d={heart(78, 108)} fill="#EF4B6E" />
          <Path d={heart(122, 108)} fill="#EF4B6E" />
          <Circle cx={73.5} cy={102} r={1.8} fill="#FFFFFF" opacity={0.8} />
          <Circle cx={117.5} cy={102} r={1.8} fill="#FFFFFF" opacity={0.8} />
        </G>
      );
    case 'stars':
      return (
        <G>
          <Path d={sparkle(78, 107)} fill={INK} />
          <Path d={sparkle(122, 107)} fill={INK} />
        </G>
      );
    default:
      return <Dots ry={open} />;
  }
}

function Mouth({ style }: { style: MouthStyle }) {
  switch (style) {
    case 'grin':
      return <Path d="M85 125 Q100 147 115 125 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
    case 'smile':
      return <Path d="M87 127 Q100 140 113 127" {...stroke} />;
    case 'soft':
      return <Path d="M91 129 Q100 136 109 129" {...stroke} />;
    case 'listen':
      return <Ellipse cx={100} cy={131} rx={5} ry={4.5} fill={INK} />;
    case 'frown':
      return <Path d="M91 134 Q100 128 109 134" {...stroke} />;
    case 'small':
      return <Ellipse cx={100} cy={131} rx={4} ry={3} fill={INK} />;
    case 'smirk':
      return <Path d="M93 132 Q102 131 110 127" {...stroke} />;
    case 'tongue':
      return (
        <G>
          <Path d="M85 125 Q100 147 115 125 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <Ellipse cx={101} cy={138} rx={7} ry={5} fill="#FF8FA3" />
        </G>
      );
    case 'cat':
      return <Path d="M87 128 Q93.5 136 100 129 Q106.5 136 113 128" {...stroke} />;
    case 'open':
      return <Ellipse cx={100} cy={132} rx={6.5} ry={8} fill={INK} />;
    case 'flat':
      return <Path d="M90 131 L110 131" {...stroke} />;
    case 'grumpy':
      return <Path d="M87 134 L93.5 129 L100 134 L106.5 129 L113 134" {...stroke} />;
  }
}

function Cheeks({ style }: { style: CheekChoice }) {
  if (style === 'none') return null;
  return (
    <G>
      <Ellipse cx={64} cy={124} rx={10} ry={6.5} fill="#FF8FAB" opacity={style === 'freckles' ? 0.28 : 0.45} />
      <Ellipse cx={136} cy={124} rx={10} ry={6.5} fill="#FF8FAB" opacity={style === 'freckles' ? 0.28 : 0.45} />
      {style === 'freckles' &&
        [
          [59, 120],
          [66, 124],
          [58, 127],
          [141, 120],
          [134, 124],
          [142, 127],
        ].map(([x, y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="#A8684C" opacity={0.6} />)}
    </G>
  );
}

function Glasses({ style }: { style: GlassesChoice }) {
  if (style === 'none') return null;
  const frame = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' as const, fill: 'none' };
  if (style === 'round') {
    return (
      <G>
        <Circle cx={78} cy={107} r={15} fill="#FFFFFF" opacity={0.18} />
        <Circle cx={122} cy={107} r={15} fill="#FFFFFF" opacity={0.18} />
        <Circle cx={78} cy={107} r={15} {...frame} />
        <Circle cx={122} cy={107} r={15} {...frame} />
        <Path d="M93 104 Q100 99 107 104" {...frame} />
        <Path d="M63 103 L52 99" {...frame} />
        <Path d="M137 103 L148 99" {...frame} />
      </G>
    );
  }
  const lens = (x: number, y: number) =>
    `M${x - 16} ${y - 7}Q${x - 16} ${y - 10} ${x - 13} ${y - 10}L${x + 13} ${y - 10}Q${x + 16} ${y - 10} ${x + 16} ${y - 7}Q${x + 15} ${y + 11} ${x} ${y + 11}Q${x - 15} ${y + 11} ${x - 16} ${y - 7}Z`;
  return (
    <G>
      <Path d={lens(78, 106)} fill={INK} />
      <Path d={lens(122, 106)} fill={INK} />
      <Path d="M70 100 L76 100" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      <Path d="M114 100 L120 100" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      <Path d="M94 98 Q100 95 106 98" {...frame} />
      <Path d="M62 99 L52 96" {...frame} />
      <Path d="M138 99 L148 96" {...frame} />
    </G>
  );
}

// ---------- Luma's flowers ----------
// Every flower is drawn around the same middle, where the face sits: petals go
// behind, then the centre (or, for the tulip, the cup) the face is drawn on.

const CX = 100;
const CY = 112;
const angles = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => offset + (360 / n) * i);
const turn = (a: number) => `rotate(${a} ${CX} ${CY})`;
const pointed = (inner: number, outer: number, w: number) => {
  const mid = CY - (inner + outer) / 2;
  return `M${CX} ${CY - inner}Q${CX + w} ${mid} ${CX} ${CY - outer}Q${CX - w} ${mid} ${CX} ${CY - inner}Z`;
};
const notched = (inner: number, outer: number, w: number) =>
  `M${CX} ${CY - inner}C${CX + w} ${CY - inner - 14} ${CX + w * 0.95} ${CY - outer + 6} ${CX + 7} ${CY - outer}L${CX} ${CY - outer + 8}L${CX - 7} ${CY - outer}C${CX - w * 0.95} ${CY - outer + 6} ${CX - w} ${CY - inner - 14} ${CX} ${CY - inner}Z`;
const TULIP_CUP =
  'M40 80 C38 62 48 52 60 58 C68 42 84 36 100 48 C116 36 132 42 140 58 C152 52 162 62 160 80 C158 130 138 172 100 174 C62 172 42 130 40 80 Z';

type Flower = {
  /** Petal colours, light to deep; null uses Luma's own colours, which follow the mood. */
  petals: [string, string, string] | null;
  /** The centre the face sits on (light, deep) and its size; null when the face sits on the petals. */
  disc: { colors: [string, string]; r: number } | null;
  draw: (fill: string) => ReactNode;
};

const FLOWER: Record<FlowerId, Flower> = {
  classic: {
    petals: null,
    disc: { colors: ['#FFF7E0', '#FFE6AD'], r: 54 },
    draw: (fill) => (
      <G>
        {angles(8).map((a) => (
          <Ellipse key={a} cx={CX} cy={CY - 57} rx={23} ry={28} fill={fill} transform={turn(a)} />
        ))}
        {angles(8, 22.5).map((a) => (
          <Ellipse key={`i${a}`} cx={CX} cy={CY - 50} rx={17} ry={21} fill="#FFFFFF" opacity={0.3} transform={turn(a)} />
        ))}
      </G>
    ),
  },
  daisy: {
    petals: ['#FFFFFF', '#FBF8FF', '#ECE4F6'],
    disc: { colors: ['#FFE98A', '#FFC23D'], r: 50 },
    draw: (fill) => (
      <G>
        {angles(14).map((a) => (
          <Ellipse key={a} cx={CX} cy={CY - 62} rx={9.5} ry={25} fill={fill} stroke="#DCD0EA" strokeWidth={1.4} transform={turn(a)} />
        ))}
      </G>
    ),
  },
  sunflower: {
    petals: ['#FFE47A', '#FFC93A', '#F5A814'],
    disc: { colors: ['#F6D094', '#E2A65C'], r: 52 },
    draw: (fill) => (
      <G>
        {angles(16, 11.25).map((a) => (
          <Path key={`b${a}`} d={pointed(44, 78, 13)} fill="#EE9F12" transform={turn(a)} />
        ))}
        {angles(16).map((a) => (
          <Path key={a} d={pointed(44, 87, 15)} fill={fill} transform={turn(a)} />
        ))}
      </G>
    ),
  },
  tulip: {
    petals: ['#FFC6CC', '#F98A9B', '#E85A74'],
    disc: null,
    draw: (fill) => (
      <G>
        <Path d="M46 86 C30 72 30 52 42 44 C54 58 62 74 66 94 Z" fill={fill} opacity={0.75} />
        <Path d="M154 86 C170 72 170 52 158 44 C146 58 138 74 134 94 Z" fill={fill} opacity={0.75} />
        <Path d={TULIP_CUP} fill={fill} />
        <Path d="M100 52 C91 62 88 74 90 86" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={4} strokeLinecap="round" fill="none" />
      </G>
    ),
  },
  blossom: {
    petals: ['#FFE4EC', '#FFC1D3', '#F39BB6'],
    disc: { colors: ['#FFFFFF', '#FFE8F0'], r: 50 },
    draw: (fill) => (
      <G>
        {angles(5).map((a) => (
          <Path key={a} d={notched(30, 88, 36)} fill={fill} transform={turn(a)} />
        ))}
      </G>
    ),
  },
  forgetmenot: {
    petals: ['#D2E4FF', '#A0BFF6', '#7897E4'],
    disc: { colors: ['#FFF6C8', '#FFDE76'], r: 49 },
    draw: (fill) => (
      <G>
        {angles(5).map((a) => (
          <Ellipse key={a} cx={CX} cy={CY - 56} rx={31} ry={30} fill={fill} transform={turn(a)} />
        ))}
      </G>
    ),
  },
};

/** Luma's arms and feet are green, like a stem and leaves. */
const ARM = '#8FCB9C';
const FOOT = '#6DB283';

/**
 * Luma's little arms and feet. Drawn before the flower, so the petals cover where
 * they join. When Luma is joyful, one hand waves.
 */
function Limbs({ mood, arm, foot }: { mood: SolMood; arm: string; foot: string }) {
  const limb = { stroke: arm, strokeWidth: 10, strokeLinecap: 'round' as const, fill: 'none' };
  const waving = mood === 'joyful';
  return (
    <G>
      {/* Legs and feet */}
      <Path d="M86 146 Q84 160 83 171" stroke={foot} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Path d="M114 146 Q116 160 117 171" stroke={foot} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Ellipse cx={78} cy={177} rx={13} ry={7.5} fill={foot} transform="rotate(-8 78 177)" />
      <Ellipse cx={122} cy={177} rx={13} ry={7.5} fill={foot} transform="rotate(8 122 177)" />
      <Ellipse cx={79} cy={181} rx={9} ry={2.6} fill={INK} opacity={0.1} />
      <Ellipse cx={121} cy={181} rx={9} ry={2.6} fill={INK} opacity={0.1} />
      {/* Arms with mitten hands */}
      <Path d="M50 100 Q32 106 27 121" {...limb} />
      <Ellipse cx={25} cy={125} rx={9} ry={9.5} fill={arm} />
      <Ellipse cx={22} cy={121} rx={3} ry={2} fill="#FFFFFF" opacity={0.35} />
      {waving ? (
        <G>
          <Path d="M150 98 Q170 90 176 74" {...limb} />
          <Ellipse cx={177} cy={70} rx={9} ry={9.5} fill={arm} />
          <Ellipse cx={174} cy={66} rx={3} ry={2} fill="#FFFFFF" opacity={0.35} />
        </G>
      ) : (
        <G>
          <Path d="M150 100 Q168 106 173 121" {...limb} />
          <Ellipse cx={175} cy={125} rx={9} ry={9.5} fill={arm} />
          <Ellipse cx={172} cy={121} rx={3} ry={2} fill="#FFFFFF" opacity={0.35} />
        </G>
      )}
    </G>
  );
}

export function Sol({
  size = 120,
  mood = 'happy',
  tint = 0,
  animated = true,
  limbs,
  look,
  moodFace = false,
  style,
}: {
  size?: number;
  mood?: SolMood;
  /** Mood value 1-5 to tint Luma, or 0 for the default glow. */
  tint?: number;
  animated?: boolean;
  /** Arms and feet. On by default for larger Sols; small ones (avatars, the tab button) stay a simple face. */
  limbs?: boolean;
  /** A look to show instead of the person's own (the wardrobe's previews). */
  look?: SolLook;
  /** The face shows `mood` whatever the person chose, e.g. in mood pickers where the face is the answer. */
  moodFace?: boolean;
  style?: ViewStyle;
}) {
  const stored = useSolLook();
  const l = look ?? stored;
  const withLimbs = limbs ?? size >= 80;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const flower = FLOWER[l.flower] ?? FLOWER.classic;
  const [c1, c2, c3] = flower.petals ?? TINTS[tint] ?? TINTS[0]!;
  const eyes: EyeStyle = moodFace || l.eyes === 'auto' ? moodEyes(mood) : l.eyes;
  const mouth: MouthStyle = moodFace || l.mouth === 'auto' ? MOOD_MOUTH[mood] : l.mouth;
  const [blink, setBlink] = useState(false);

  const float = useSharedValue(0);
  const breathe = useSharedValue(1);
  useEffect(() => {
    if (!animated) return;
    float.value = withRepeat(
      withSequence(
        withTiming(-size * 0.04, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [animated, size, float, breathe]);

  useEffect(() => {
    if (!animated) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setBlink(true);
        timer = setTimeout(() => {
          setBlink(false);
          schedule();
        }, 140);
      }, 2600 + Math.random() * 2800);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [animated]);

  const motion = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: breathe.value }],
  }));

  return (
    <View style={[{ width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel="Luma, your companion">
      <Animated.View style={[{ width: size, height: size }, motion]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id={`glow${id}`} cx="50%" cy="56%" r="50%">
              <Stop offset="0%" stopColor={c2} stopOpacity={0.55} />
              <Stop offset="100%" stopColor={c2} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={`petal${id}`} x1={30} y1={24} x2={170} y2={200} gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor={c1} />
              <Stop offset="55%" stopColor={c2} />
              <Stop offset="100%" stopColor={c3} />
            </LinearGradient>
            {flower.disc && (
              <LinearGradient id={`disc${id}`} x1="0.2" y1="0.1" x2="0.8" y2="1">
                <Stop offset="0%" stopColor={flower.disc.colors[0]} />
                <Stop offset="100%" stopColor={flower.disc.colors[1]} />
              </LinearGradient>
            )}
          </Defs>
          <Circle cx={100} cy={112} r={98} fill={`url(#glow${id})`} />
          {withLimbs && <Limbs mood={mood} arm={ARM} foot={FOOT} />}
          {/* With limbs, the flower is drawn a little smaller and higher to leave room for the feet. */}
          <G transform={withLimbs ? 'translate(20 2) scale(0.8)' : undefined}>
            {flower.draw(`url(#petal${id})`)}
            {flower.disc && <Circle cx={CX} cy={CY} r={flower.disc.r} fill={`url(#disc${id})`} />}
            <Ellipse cx={80} cy={84} rx={13} ry={6.5} fill="#FFFFFF" opacity={0.5} transform="rotate(-28 80 84)" />
            <Cheeks style={l.cheeks} />
            <Eyes style={eyes} blink={blink} />
            <Mouth style={mouth} />
            <Glasses style={l.glasses} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}
