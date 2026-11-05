import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { T } from '@/components/ui';
import { dayKey } from '@/lib/format';
import { accent, MOODS, useTheme } from '@/theme';

/** Mood over the last `days` days: a soft line with a coloured dot per check-in day. */
export function MoodChart({ points, days = 14 }: { points: { day: string; mood: number }[]; days?: number }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const height = 150;
  const padX = 12;
  const padY = 16;

  const today = new Date();
  const slots = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    return dayKey(d);
  });
  const byDay = new Map(points.map((p) => [p.day, p.mood]));
  const x = (i: number) => padX + (i * (width - padX * 2)) / (days - 1);
  const y = (mood: number) => padY + ((5 - mood) * (height - padY * 2)) / 4;
  const plotted = slots.map((day, i) => ({ i, day, mood: byDay.get(day) })).filter((p): p is { i: number; day: string; mood: number } => p.mood != null);

  let path = '';
  plotted.forEach((p, idx) => {
    const px = x(p.i);
    const py = y(p.mood);
    if (idx === 0) path = `M ${px} ${py}`;
    else {
      const prev = plotted[idx - 1]!;
      const cx = (x(prev.i) + px) / 2;
      path += ` C ${cx} ${y(prev.mood)}, ${cx} ${py}, ${px} ${py}`;
    }
  });
  const area = plotted.length > 1 ? `${path} L ${x(plotted[plotted.length - 1]!.i)} ${height} L ${x(plotted[0]!.i)} ${height} Z` : '';

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={c.primary} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={c.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[1, 3, 5].map((m) => (
            <Line key={m} x1={padX} x2={width - padX} y1={y(m)} y2={y(m)} stroke={c.line} strokeDasharray="4 6" />
          ))}
          {area ? <Path d={area} fill="url(#moodArea)" /> : null}
          {path ? <Path d={path} stroke={c.primary} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
          {plotted.map((p) => {
            const a = accent(c, MOODS[Math.round(p.mood) - 1]?.accent ?? 'lavender');
            return <Circle key={p.day} cx={x(p.i)} cy={y(p.mood)} r={6} fill={a.strong} stroke={c.surface} strokeWidth={2.5} />;
          })}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <T variant="small" color={c.inkFaint} style={{ fontSize: 11 }}>
          {days} days ago
        </T>
        <T variant="small" color={c.inkFaint} style={{ fontSize: 11 }}>
          Today
        </T>
      </View>
    </View>
  );
}
