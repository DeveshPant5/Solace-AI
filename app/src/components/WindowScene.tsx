import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * A cosy window for Pip to stand in front of: curtains tied back, a wooden
 * sill, and a sky that follows the time of day (rising sun, high sun with
 * drifting clouds, sunset, or moon and stars). Fills its parent; Pip stands
 * on the sill, `sill` points up from the bottom.
 *
 * Motion is slow and optional: clouds take about a minute to cross, stars
 * twinkle over several seconds, and nothing moves with reduced motion on.
 */

type Slot = 0 | 1 | 2 | 3; // morning, afternoon, evening, night

function slotNow(): Slot {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 0;
  if (h >= 12 && h < 17) return 1;
  if (h >= 17 && h < 21) return 2;
  return 3;
}

const SKY: Record<Slot, { sky: [string, string]; sun: string; glow: string; hillBack: string; hillFront: string }> = {
  0: { sky: ['#FCDCC6', '#FCEFE3'], sun: '#FFC08A', glow: '#FFD9B0', hillBack: '#C9E2C4', hillFront: '#A6D0A8' },
  1: { sky: ['#C9E3F2', '#F1F1E6'], sun: '#FFE08A', glow: '#FFF0C2', hillBack: '#BEDDBE', hillFront: '#98C89C' },
  2: { sky: ['#F1C2BB', '#F6DED2'], sun: '#FFA487', glow: '#FFC9B0', hillBack: '#C5C9A7', hillFront: '#A5B88F' },
  // Night is a soft dusky lavender rather than deep navy, so it stays gentle next to the warm room.
  3: { sky: ['#6F69A8', '#CBBBE0'], sun: '#FFF6DE', glow: '#F1ECFF', hillBack: '#8D8BB5', hillFront: '#71739C' },
};

/** Where the sun or moon sits, as a fraction of the window. */
// Across, as a fraction of the window; down, as a fraction of the open band between the bubble and Pip.
const SUN_AT: Record<Slot, [number, number]> = { 0: [0.16, 0.75], 1: [0.84, 0.35], 2: [0.84, 0.85], 3: [0.15, 0.4] };

const STARS: [number, number, number][] = [
  [0.12, 0.1, 1.6], [0.24, 0.24, 1.2], [0.36, 0.08, 1.4], [0.5, 0.18, 1.1], [0.62, 0.06, 1.5],
  [0.9, 0.34, 1.2], [0.16, 0.42, 1.1], [0.42, 0.36, 1.3], [0.68, 0.4, 1.0], [0.86, 0.08, 1.2],
  [0.3, 0.52, 1.0], [0.56, 0.5, 1.2],
];

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <G opacity={0.85}>
      <Ellipse cx={x} cy={y} rx={26 * s} ry={11 * s} fill="#FFFFFF" />
      <Circle cx={x - 10 * s} cy={y - 7 * s} r={11 * s} fill="#FFFFFF" />
      <Circle cx={x + 8 * s} cy={y - 10 * s} r={14 * s} fill="#FFFFFF" />
    </G>
  );
}

export function WindowScene({ sill = 22, bandTop = 170, bandBottomFromSill = 236 }: { sill?: number; bandTop?: number; bandBottomFromSill?: number }) {
  const c = useTheme();
  const reduceMotion = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [slot] = useState<Slot>(slotNow);
  const drift = useSharedValue(0);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1);
    twinkle.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(drift);
      cancelAnimation(twinkle);
    };
  }, [reduceMotion, drift, twinkle]);

  const w = box?.w ?? 0;
  const h = box?.h ?? 0;
  // The cloud pattern repeats once, so sliding exactly one window-width loops without a jump.
  const clouds = useAnimatedStyle(() => ({ transform: [{ translateX: -drift.value * (w - 28) }] }), [w]);
  const starsA = useAnimatedStyle(() => ({ opacity: 0.45 + twinkle.value * 0.55 }));
  const starsB = useAnimatedStyle(() => ({ opacity: 1 - twinkle.value * 0.55 }));

  const dark = c.scheme === 'dark';
  const frame = dark ? '#3A312A' : '#FFFDF9';
  const frameLine = dark ? '#4A3F36' : '#EADFD1';
  const sillTop = dark ? '#4A3D33' : '#EAD7BE';
  const sillFront = dark ? '#3B3029' : '#D9BF9F';
  const curtain = dark ? '#3D332C' : '#F3E4D2';
  const fold = dark ? '#4A3E35' : '#E7D1BB';
  const tie = dark ? '#5E7D66' : '#A9CBB0';
  const rod = dark ? '#6B5644' : '#C9A882';

  const t = SKY[slot];
  const inset = 14;
  const radius = 26;
  const winW = w - inset * 2;
  const winH = h - sill;
  // The open sky between the speech bubble (top) and Pip (bottom), where the sun, moon and clouds go.
  const bandBottom = Math.max(bandTop + 60, winH - bandBottomFromSill);
  const band = (f: number) => bandTop + (bandBottom - bandTop) * f - 8;
  const [sx, sf] = SUN_AT[slot];
  const cw = Math.min(58, w * 0.14);
  const pinch = winH * 0.56;

  const curtainPath = (left: boolean) => {
    // Hangs from the rod, is tied back about halfway down, then falls to the sill.
    const x0 = left ? 4 : w - 4;
    const d = left ? 1 : -1;
    const X = (dx: number) => x0 + d * dx;
    return `M${X(0)} 10 L${X(cw)} 10 C${X(cw * 0.7)} ${pinch * 0.45} ${X(cw * 0.42)} ${pinch * 0.8} ${X(cw * 0.42)} ${pinch} C${X(cw * 0.5)} ${pinch + winH * 0.16} ${X(cw * 0.85)} ${winH * 0.86} ${X(cw * 0.95)} ${winH} L${X(0)} ${winH} Z`;
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box && (
        <>
          {/* Through the window */}
          <View style={{ position: 'absolute', left: inset, top: 8, width: winW, height: winH - 8, borderTopLeftRadius: radius, borderTopRightRadius: radius, overflow: 'hidden' }}>
            <LinearGradient colors={t.sky} style={StyleSheet.absoluteFill} />
            <Svg width={winW} height={winH - 8} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={t.glow} stopOpacity={0.9} />
                  <Stop offset="1" stopColor={t.glow} stopOpacity={0} />
                </RadialGradient>
                {/* The moon's crescent is cut out, so the sky and glow show through instead of a painted disc. */}
                <Mask id="crescent" maskUnits="userSpaceOnUse" x={0} y={0} width={winW} height={winH}>
                  <Rect x={0} y={0} width={winW} height={winH} fill="#FFFFFF" />
                  <Circle cx={winW * sx + 7} cy={band(sf) - 5} r={15} fill="#000000" />
                </Mask>
              </Defs>
              <Circle cx={winW * sx} cy={band(sf)} r={62} fill="url(#sunGlow)" />
              <Circle cx={winW * sx} cy={band(sf)} r={slot === 3 ? 17 : 22} fill={t.sun} mask={slot === 3 ? 'url(#crescent)' : undefined} />
              {/* Rolling hills far away */}
              <Path
                d={`M0 ${winH * 0.74} C${winW * 0.25} ${winH * 0.64} ${winW * 0.45} ${winH * 0.72} ${winW * 0.62} ${winH * 0.68} C${winW * 0.8} ${winH * 0.64} ${winW * 0.92} ${winH * 0.7} ${winW} ${winH * 0.67} L${winW} ${winH} L0 ${winH} Z`}
                fill={t.hillBack}
              />
              <Path
                d={`M0 ${winH * 0.84} C${winW * 0.2} ${winH * 0.78} ${winW * 0.4} ${winH * 0.86} ${winW * 0.6} ${winH * 0.8} C${winW * 0.78} ${winH * 0.75} ${winW * 0.9} ${winH * 0.82} ${winW} ${winH * 0.79} L${winW} ${winH} L0 ${winH} Z`}
                fill={t.hillFront}
              />
            </Svg>
            {slot === 3 ? (
              <>
                <Animated.View style={[StyleSheet.absoluteFill, starsA]}>
                  <Svg width={winW} height={winH}>
                    {STARS.filter((_, i) => i % 2 === 0).map(([x, y, r], i) => (
                      <Circle key={i} cx={winW * x} cy={winH * y} r={r} fill="#FFF8E7" />
                    ))}
                  </Svg>
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, starsB]}>
                  <Svg width={winW} height={winH}>
                    {STARS.filter((_, i) => i % 2 === 1).map(([x, y, r], i) => (
                      <Circle key={i} cx={winW * x} cy={winH * y} r={r} fill="#FFF8E7" />
                    ))}
                  </Svg>
                </Animated.View>
              </>
            ) : (
              <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: winW * 2, height: winH }, clouds]}>
                <Svg width={winW * 2} height={winH}>
                  {[0, winW].map((off) => (
                    <G key={off}>
                      <Cloud x={off + winW * 0.18} y={band(0.35)} s={0.9} />
                      <Cloud x={off + winW * 0.58} y={band(0.75)} s={0.7} />
                      <Cloud x={off + winW * 0.9} y={band(0.15)} s={0.6} />
                    </G>
                  ))}
                </Svg>
              </Animated.View>
            )}
          </View>

          {/* Frame, curtains, rod and sill */}
          <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
            <Path
              d={`M${inset} ${winH} L${inset} ${8 + radius} Q${inset} 8 ${inset + radius} 8 L${w - inset - radius} 8 Q${w - inset} 8 ${w - inset} ${8 + radius} L${w - inset} ${winH}`}
              stroke={frame}
              strokeWidth={10}
              fill="none"
            />
            <Path
              d={`M${inset + 5} ${winH} L${inset + 5} ${13 + radius} Q${inset + 5} 13 ${inset + 5 + radius} 13 L${w - inset - 5 - radius} 13 Q${w - inset - 5} 13 ${w - inset - 5} ${13 + radius} L${w - inset - 5} ${winH}`}
              stroke={frameLine}
              strokeWidth={1.5}
              fill="none"
            />
            <Rect x={0} y={3} width={w} height={5} rx={2.5} fill={rod} />
            <Circle cx={4} cy={5.5} r={5} fill={rod} />
            <Circle cx={w - 4} cy={5.5} r={5} fill={rod} />
            {[true, false].map((left) => (
              <G key={String(left)}>
                <Path d={curtainPath(left)} fill={curtain} />
                <Path
                  d={`M${left ? 4 + cw * 0.5 : w - 4 - cw * 0.5} 12 C${left ? 4 + cw * 0.38 : w - 4 - cw * 0.38} ${pinch * 0.6} ${left ? 4 + cw * 0.3 : w - 4 - cw * 0.3} ${pinch * 0.85} ${left ? 4 + cw * 0.3 : w - 4 - cw * 0.3} ${pinch}`}
                  stroke={fold}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path
                  d={`M${left ? 4 + cw * 0.3 : w - 4 - cw * 0.3} ${pinch + 6} C${left ? 4 + cw * 0.36 : w - 4 - cw * 0.36} ${pinch + winH * 0.18} ${left ? 4 + cw * 0.5 : w - 4 - cw * 0.5} ${winH * 0.85} ${left ? 4 + cw * 0.55 : w - 4 - cw * 0.55} ${winH - 2}`}
                  stroke={fold}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                />
                <Rect x={left ? 4 + cw * 0.2 : w - 4 - cw * 0.66} y={pinch - 4} width={cw * 0.46} height={8} rx={4} fill={tie} />
              </G>
            ))}
            <Rect x={0} y={winH} width={w} height={sill - 6} rx={5} fill={sillTop} />
            <Rect x={2} y={winH + sill - 9} width={w - 4} height={9} rx={4} fill={sillFront} />
          </Svg>
        </>
      )}
    </View>
  );
}
