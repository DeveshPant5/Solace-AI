import { Feather } from '@expo/vector-icons';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { HandIcon, HandIconTile } from '@/components/HandIcon';
import { Row, T, Tappable } from '@/components/ui';
import { formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { DAY_LETTERS, daysLabel, dayName, hasDay, taskLook, WEEK_ORDER } from '@/lib/tasks';
import type { TaskItem } from '@/lib/types';
import { accent, fonts, radius, space, useTheme } from '@/theme';

/** A hand-drawn circle that fills in with a tick when the task is done. */
export function TickCircle({ done, size = 30 }: { done: boolean; size?: number }) {
  const c = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12.2 2.9c5 .1 8.9 4.1 8.9 9.2 0 5-4.2 9.1-9.2 9-5-.1-8.9-4.2-8.8-9.2.1-5 4.1-9.1 9.1-9z"
        fill={done ? c.primary : 'none'}
        stroke={done ? c.primary : c.inkFaint}
        strokeWidth={1.6}
      />
      {done && (
        <Path d="M7.9 12.5l2.8 2.8 5.6-6" fill="none" stroke={c.primaryInk} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </Svg>
  );
}

/**
 * One task: its drawing, name, time and days, and a tick for today. `onPress`
 * opens it (the practice, or the editor); `onToggle` ticks it on or off.
 */
export function TaskRow({
  task,
  onPress,
  onToggle,
  showDays = true,
  chevron = false,
}: {
  task: TaskItem;
  onPress: () => void;
  onToggle?: () => void;
  showDays?: boolean;
  chevron?: boolean;
}) {
  const c = useTheme();
  const look = taskLook(task);
  const a = accent(c, look.accent);
  const details = [formatTime(task.hour, task.minute), showDays ? daysLabel(task.days) : null, task.minutes ? `${task.minutes} min` : null]
    .filter(Boolean)
    .join(' · ');
  const lockedDone = task.doneVia === 'practice';
  return (
    <Row gap={space.md} style={{ paddingVertical: space.sm }}>
      <Tappable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${task.title}, ${details}`} style={{ flex: 1 }} scaleTo={0.98}>
        <Row gap={space.md}>
          <HandIconTile name={look.icon} size={42} bg={a.soft} fg={a.strong} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong" color={task.doneToday ? c.inkSoft : c.ink} numberOfLines={1}>
              {task.title}
            </T>
            <T variant="small" color={c.inkSoft} numberOfLines={1}>
              {details}
            </T>
          </View>
          {chevron && <Feather name="chevron-right" size={18} color={c.inkFaint} />}
        </Row>
      </Tappable>
      {onToggle && (
        <Tappable
          onPress={lockedDone ? undefined : onToggle}
          haptics={false}
          disabled={lockedDone}
          hitSlop={10}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.doneToday, disabled: lockedDone }}
          accessibilityLabel={lockedDone ? `${task.title}: done in the app today` : `Mark ${task.title} done for today`}
        >
          {task.doneToday ? (
            <Animated.View entering={ZoomIn.duration(250)}>
              <TickCircle done />
            </Animated.View>
          ) : (
            <TickCircle done={false} />
          )}
        </Tappable>
      )}
    </Row>
  );
}

/** A choice with a hand-drawn icon, for picking what a task is. */
export function ChoiceChip({ label, icon, selected, onPress }: { label: string; icon: string; selected: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Tappable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 9,
        paddingLeft: 10,
        paddingRight: 14,
        borderRadius: radius.pill,
        backgroundColor: selected ? c.primarySoft : c.surface,
        borderWidth: 1.5,
        borderColor: selected ? c.primary : c.line,
      }}
    >
      <HandIcon name={icon} size={20} color={selected ? c.primary : c.inkSoft} />
      <T variant="small" color={selected ? c.primary : c.ink} style={selected ? { fontFamily: fonts.bold } : undefined}>
        {label}
      </T>
    </Tappable>
  );
}

const QUICK_TIMES = [
  { label: 'Morning', hour: 8, minute: 0 },
  { label: 'Afternoon', hour: 15, minute: 0 },
  { label: 'Evening', hour: 19, minute: 0 },
  { label: 'Night', hour: 21, minute: 30 },
];

function Stepper({ icon, label, onPress }: { icon: 'chevron-up' | 'chevron-down'; label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Tappable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={{ padding: 6, borderRadius: radius.pill, backgroundColor: c.sunken }}>
      <Feather name={icon} size={18} color={c.inkSoft} />
    </Tappable>
  );
}

/** Picks a time of day: hour and minute steppers, AM/PM, and a few quick times. */
export function TimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (hour: number, minute: number) => void }) {
  const c = useTheme();
  const pm = hour >= 12;
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  const set = (h: number, m: number) => {
    haptic.tap();
    onChange(((h % 24) + 24) % 24, ((m % 60) + 60) % 60);
  };
  const big = { fontFamily: fonts.display, fontSize: 44, lineHeight: 52, color: c.ink, fontVariant: ['tabular-nums' as const] };
  return (
    <View style={{ gap: space.lg }}>
      <Row gap={space.lg} style={{ justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Stepper icon="chevron-up" label="An hour later" onPress={() => set(hour + 1, minute)} />
          <T style={[big, { minWidth: 60, textAlign: 'center' }]}>{shown}</T>
          <Stepper icon="chevron-down" label="An hour earlier" onPress={() => set(hour - 1, minute)} />
        </View>
        <T style={[big, { marginTop: -4 }]}>:</T>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Stepper icon="chevron-up" label="Five minutes later" onPress={() => set(hour, Math.floor(minute / 5) * 5 + 5)} />
          <T style={[big, { minWidth: 60, textAlign: 'center' }]}>{String(minute).padStart(2, '0')}</T>
          <Stepper icon="chevron-down" label="Five minutes earlier" onPress={() => set(hour, Math.ceil(minute / 5) * 5 - 5)} />
        </View>
        <View style={{ gap: 6, marginLeft: space.sm }}>
          {(['AM', 'PM'] as const).map((half) => {
            const on = (half === 'PM') === pm;
            return (
              <Tappable
                key={half}
                onPress={() => !on && set(hour + (half === 'PM' ? 12 : -12), minute)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  backgroundColor: on ? c.primary : c.sunken,
                }}
              >
                <T variant="small" color={on ? c.primaryInk : c.inkSoft} style={{ fontFamily: fonts.bold }}>
                  {half}
                </T>
              </Tappable>
            );
          })}
        </View>
      </Row>
      <Row gap={space.sm} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {QUICK_TIMES.map((q) => {
          const on = q.hour === hour && q.minute === minute;
          return (
            <Tappable
              key={q.label}
              onPress={() => set(q.hour, q.minute)}
              accessibilityRole="button"
              accessibilityLabel={`${q.label}, ${formatTime(q.hour, q.minute)}`}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? c.primary : c.line,
                backgroundColor: on ? c.primarySoft : 'transparent',
              }}
            >
              <T variant="small" color={on ? c.primary : c.inkSoft}>
                {q.label}
              </T>
            </Tappable>
          );
        })}
      </Row>
    </View>
  );
}

/** Seven day circles, Monday first. At least one day always stays picked. */
export function DayPicker({ days, onChange }: { days: number; onChange: (days: number) => void }) {
  const c = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        {WEEK_ORDER.map((d) => {
          const on = hasDay(days, d);
          return (
            <Tappable
              key={d}
              onPress={() => {
                const next = days ^ (1 << d);
                if (next === 0) return;
                haptic.tap();
                onChange(next);
              }}
              haptics={false}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={dayName(d)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? c.primary : c.sunken,
              }}
            >
              <T variant="small" color={on ? c.primaryInk : c.inkSoft} style={{ fontFamily: fonts.bold }}>
                {DAY_LETTERS[d]}
              </T>
            </Tappable>
          );
        })}
      </Row>
      <T variant="small" color={c.inkSoft} center>
        {daysLabel(days)}
      </T>
    </View>
  );
}
