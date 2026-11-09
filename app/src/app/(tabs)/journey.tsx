import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { MoodChart } from '@/components/MoodChart';
import { Pip, pipStage } from '@/components/Pip';
import { PipTip } from '@/components/PipTip';
import { PatchBadge } from '@/components/HandIcon';
import { Sol } from '@/components/Sol';
import { Button, Card, ErrorNote, IconBadge, ProgressBar, Row, Screen, SectionTitle, T, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { dayKey } from '@/lib/format';
import { setPipLevel } from '@/lib/pipGrowth';
import type { ProgressData, Reflection } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { radius, space, useTheme } from '@/theme';

/** Each achievement's patch: a little drawing and the thread colour it's stitched in. */
const ACHIEVEMENT_PATCHES: Record<string, { drawing: string; tone: 'sage' | 'lavender' | 'butter' | 'sky' | 'peach' | 'rose' }> = {
  first_checkin: { drawing: 'sprout', tone: 'sage' },
  streak_3: { drawing: 'growing', tone: 'lavender' },
  streak_7: { drawing: 'sun', tone: 'butter' },
  breath_5: { drawing: 'wind', tone: 'sky' },
  ground_1: { drawing: 'footprints', tone: 'peach' },
  journal_3: { drawing: 'notebook', tone: 'rose' },
  talk_1: { drawing: 'chat-heart', tone: 'lavender' },
  checks_all: { drawing: 'compass', tone: 'sage' },
};

function WeekStrip({ activeDays }: { activeDays: string[] }) {
  const c = useTheme();
  const set = new Set(activeDays);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
      {days.map((d) => {
        const active = set.has(dayKey(d));
        const isToday = dayKey(d) === dayKey(today);
        return (
          <View key={dayKey(d)} style={{ alignItems: 'center', gap: 6 }}>
            <T variant="small" color={isToday ? c.ink : c.inkFaint} style={{ fontSize: 12 }}>
              {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </T>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: active ? c.peach : c.sunken,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: isToday ? 2 : 0,
                borderColor: c.peach,
              }}
            >
              {active && <Feather name="zap" size={15} color="#FFFFFF" />}
            </View>
          </View>
        );
      })}
    </Row>
  );
}

export default function Journey() {
  const c = useTheme();
  const { data, error, reload } = useApi<ProgressData>('/progress');
  const [reflection, setReflection] = useState<Reflection | null | undefined>(undefined);

  useEffect(() => {
    api<{ reflection: Reflection | null }>('/progress/reflection')
      .then((r) => setReflection(r.reflection))
      .catch(() => setReflection(null));
  }, []);

  const p = data;
  useEffect(() => {
    if (p?.level) setPipLevel(p.level);
  }, [p?.level]);
  const levelProgress = p && p.nextLevelXp ? (p.xp - p.levelStartXp) / (p.nextLevelXp - p.levelStartXp) : 1;

  return (
    <Screen tabBar>
      <T variant="title">Your journey</T>
      <T variant="body" color={c.inkSoft} style={{ marginTop: 4 }}>
        Every small step counts. Here’s how far you’ve come.
      </T>
      <PipTip id="journey" style={{ marginTop: space.xl, marginBottom: 0 }} />
      {error && !data && (
        <View style={{ marginTop: space.lg }}>
          <ErrorNote message={error} onRetry={reload} />
        </View>
      )}

      {p && (
        <Animated.View entering={FadeInDown}>
          <Card style={{ marginTop: space.xl }}>
            <Row gap={space.lg}>
              <View style={{ backgroundColor: c.sageSoft, borderRadius: radius.lg, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 }}>
                <Pip size={96} stage={pipStage(p.level)} mood={p.level >= 5 ? 'happy' : 'calm'} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="caption" color={c.inkSoft}>
                  Level {p.level}
                </T>
                <T variant="title">{p.name}</T>
                <T variant="small" color={c.inkSoft}>
                  {p.xp} XP{p.nextLevelXp ? ` · ${p.nextLevelXp - p.xp} to ${p.nextLevelName}` : ''}
                </T>
                <View style={{ marginTop: space.sm }}>
                  <ProgressBar value={levelProgress} color={c.sage} track={c.sageSoft} height={10} />
                </View>
                <T variant="small" color={c.inkFaint} style={{ marginTop: 2 }}>
                  Pip grows a little with every step you take.
                </T>
              </View>
            </Row>
          </Card>

          <Card style={{ marginTop: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T variant="caption" color={c.inkSoft}>
                  Current streak
                </T>
                <T variant="title">
                  {p.streak.current} day{p.streak.current === 1 ? '' : 's'}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T variant="caption" color={c.inkSoft}>
                  Longest
                </T>
                <T variant="heading">{p.streak.longest}</T>
              </View>
            </Row>
            <WeekStrip activeDays={p.activeDays} />
            {!p.streak.activeToday && (
              <T variant="small" color={c.inkSoft} style={{ marginTop: space.md }}>
                Do any small thing today to keep your streak going.
              </T>
            )}
          </Card>
        </Animated.View>
      )}

      <SectionTitle title="Sol’s reflection" />
      <Card tone={c.lavenderSoft} style={{ gap: space.md }}>
        {reflection === undefined ? (
          <Row gap={space.md}>
            <Sol size={48} mood="thinking" />
            <T variant="small" color={c.inkSoft}>
              Looking back at your week…
            </T>
          </Row>
        ) : reflection ? (
          <Animated.View entering={FadeIn} style={{ gap: space.md }}>
            <Row gap={space.md}>
              <Sol size={48} mood="happy" animated={false} />
              <T variant="heading" style={{ flex: 1 }}>
                {reflection.headline}
              </T>
            </Row>
            <T variant="body">{reflection.reflection}</T>
            {reflection.highlights.map((h) => (
              <Row key={h} gap={8} style={{ alignItems: 'flex-start' }}>
                <Feather name="check-circle" size={16} color={c.success} style={{ marginTop: 3 }} />
                <T variant="small" style={{ flex: 1 }}>
                  {h}
                </T>
              </Row>
            ))}
            <View style={{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.md, gap: 2 }}>
              <T variant="caption" color={c.primary}>
                A gentle goal
              </T>
              <T variant="bodyStrong">{reflection.gentleGoal}</T>
            </View>
          </Animated.View>
        ) : (
          <Row gap={space.md}>
            <Sol size={48} mood="calm" animated={false} />
            <T variant="small" color={c.inkSoft} style={{ flex: 1 }}>
              Check in a few times this week and Sol will reflect on how it’s been going.
            </T>
          </Row>
        )}
      </Card>

      <SectionTitle title="Mood" action="Check in" onAction={() => router.push('/checkin')} />
      <Card>
        {p && p.moodDays.length > 0 ? (
          <MoodChart points={p.moodDays} />
        ) : (
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
            <T variant="small" color={c.inkSoft} center>
              Your mood chart appears after your first check-in.
            </T>
            <Button title="Check in now" small onPress={() => router.push('/checkin')} />
          </View>
        )}
      </Card>

      {p && (
        <>
          <SectionTitle title="Showing up" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {[
              { label: 'Check-ins', value: p.counts.checkins, icon: 'heart' as const, bg: c.roseSoft, fg: c.rose },
              { label: 'Breathing', value: p.counts.breathing, icon: 'wind' as const, bg: c.skySoft, fg: c.sky },
              { label: 'Journal', value: p.counts.journal, icon: 'feather' as const, bg: c.butterSoft, fg: c.butter },
              { label: 'Chats', value: p.counts.conversations, icon: 'message-circle' as const, bg: c.lavenderSoft, fg: c.primary },
            ].map((s) => (
              <Card key={s.label} style={{ width: '47.5%', flexGrow: 1, padding: space.lg, gap: space.sm }}>
                <IconBadge icon={s.icon} bg={s.bg} fg={s.fg} size={36} />
                <T variant="title">{s.value}</T>
                <T variant="small" color={c.inkSoft}>
                  {s.label}
                </T>
              </Card>
            ))}
          </View>

          <SectionTitle title="Achievements" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {p.achievements.map((a) => (
              <View
                key={a.id}
                style={{
                  width: '47.5%',
                  flexGrow: 1,
                  backgroundColor: c.surface,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: c.line,
                  padding: space.lg,
                  gap: 6,
                }}
              >
                {(() => {
                  const patch = ACHIEVEMENT_PATCHES[a.id] ?? { drawing: 'award', tone: 'butter' as const };
                  const soft = c[`${patch.tone}Soft` as const];
                  return (
                    <PatchBadge
                      name={patch.drawing}
                      earned={a.earned}
                      bg={a.earned ? soft : c.sunken}
                      fg={a.earned ? c[patch.tone] : c.inkFaint}
                      size={50}
                    />
                  );
                })()}
                <T variant="bodyStrong" color={a.earned ? c.ink : c.inkSoft}>
                  {a.title}
                </T>
                <T variant="small" color={c.inkSoft} style={{ fontSize: 13, lineHeight: 18 }}>
                  {a.description}
                </T>
                {!a.earned && a.goal > 1 && <ProgressBar value={a.value / a.goal} color={c.butter} track={c.sunken} height={5} />}
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
