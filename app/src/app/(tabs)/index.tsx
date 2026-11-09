import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard } from '@/components/ActivityCard';
import { Pip } from '@/components/Pip';
import { PipTour } from '@/components/PipTour';
import { moodToExpression, Sol } from '@/components/Sol';
import { Card, ErrorNote, IconBadge, Pill, ProgressBar, Row, SectionTitle, T, Tappable, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { setPipLevel, usePipStage } from '@/lib/pipGrowth';
import type { DailyCard, HomeData } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { accent, daylight, MOODS, radius, shadow, space, useTheme, type Accent } from '@/theme';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Good night';
}

const QUICK: { title: string; sub: string; icon: IconName; accent: Accent; href: Parameters<typeof router.push>[0] }[] = [
  { title: 'Talk to Sol', sub: 'Talk it through', icon: 'message-circle', accent: 'lavender', href: '/sol' },
  { title: 'Breathe', sub: '2-min reset', icon: 'wind', accent: 'sky', href: '/breathe/calm' },
  { title: 'Journal', sub: 'Untangle thoughts', icon: 'feather', accent: 'butter', href: '/journal/new' },
  { title: 'Check-ins', sub: 'Know yourself', icon: 'clipboard', accent: 'sage', href: '/practices' },
];

export default function Home() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error, reload } = useApi<HomeData>('/home');
  const [refreshing, setRefreshing] = useState(false);
  const [daily, setDaily] = useState<DailyCard | null>(null);
  const pipStage = usePipStage();

  useEffect(() => {
    if (data?.progress.level) setPipLevel(data.progress.level);
  }, [data?.progress.level]);

  useEffect(() => {
    if (!data) return;
    if (data.daily) return setDaily(data.daily);
    let cancelled = false;
    api<{ daily: DailyCard }>('/home/daily')
      .then((r) => !cancelled && setDaily(r.daily))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const p = data?.progress;
  const mood = data?.todayMood?.mood ?? null;
  const levelProgress = p && p.nextLevelXp ? (p.xp - p.levelStartXp) / (p.nextLevelXp - p.levelStartXp) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient colors={[daylight(c), c.bg]} style={StyleSheet.absoluteFill} end={{ x: 0, y: 0.45 }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.xl, paddingBottom: insets.bottom + 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T variant="small" color={c.inkSoft}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </T>
            <T variant="title" numberOfLines={1}>
              {greeting()}
              {data?.name ? `, ${data.name}` : ''}
            </T>
          </View>
          {p && (
            <Tappable onPress={() => router.push('/journey')} accessibilityLabel={`${p.streak.current} day streak`}>
              <Pill
                text={`${p.streak.current} day${p.streak.current === 1 ? '' : 's'}`}
                icon="zap"
                bg={p.streak.activeToday ? c.peachSoft : c.sunken}
                fg={p.streak.activeToday ? c.peach : c.inkSoft}
              />
            </Tappable>
          )}
        </Row>

        {error && !data && (
          <View style={{ marginTop: space.lg }}>
            <ErrorNote message={error} onRetry={reload} />
          </View>
        )}

        {/* Check-in hero */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Card style={{ marginTop: space.xl, paddingVertical: space.xxl, alignItems: 'center' }}>
            <Sol size={120} mood={moodToExpression(mood)} tint={mood ?? 0} />
            {mood ? (
              <>
                <T variant="heading" center style={{ marginTop: space.md }}>
                  You’re feeling {MOODS[mood - 1]!.label.toLowerCase()} today
                </T>
                {data?.todayMood?.emotions.length ? (
                  <T variant="small" color={c.inkSoft} center style={{ marginTop: 4 }}>
                    {data.todayMood.emotions.join(' · ')}
                  </T>
                ) : null}
                <Tappable onPress={() => router.push('/checkin')} style={{ marginTop: space.md }}>
                  <T variant="small" color={c.primary}>
                    Check in again
                  </T>
                </Tappable>
              </>
            ) : (
              <>
                <T variant="heading" center style={{ marginTop: space.md }}>
                  How are you feeling right now?
                </T>
                <Row gap={space.sm} style={{ marginTop: space.lg }}>
                  {MOODS.map((m) => {
                    const a = accent(c, m.accent);
                    return (
                      <Tappable
                        key={m.value}
                        onPress={() => {
                          haptic.soft();
                          router.push({ pathname: '/checkin', params: { mood: String(m.value) } });
                        }}
                        accessibilityLabel={m.label}
                        style={{ alignItems: 'center', gap: 4 }}
                      >
                        <View style={{ backgroundColor: a.soft, borderRadius: 18, padding: 3 }}>
                          <Sol size={44} mood={moodToExpression(m.value)} tint={m.value} animated={false} />
                        </View>
                        <T variant="small" color={c.inkSoft} style={{ fontSize: 11 }}>
                          {m.label}
                        </T>
                      </Tappable>
                    );
                  })}
                </Row>
              </>
            )}
          </Card>
        </Animated.View>

        {/* Affirmation */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <LinearGradient
            colors={c.scheme === 'dark' ? ['#3B2A20', '#36301C'] : ['#FCE0CF', '#FAEFD2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[{ borderRadius: radius.lg, padding: space.xl, marginTop: space.lg }, shadow(c, 1)]}
          >
            <Row gap={6}>
              <Feather name="sun" size={14} color={c.ink} />
              <T variant="caption" color={c.ink}>
                Today’s affirmation
              </T>
            </Row>
            {daily ? (
              <Animated.View entering={FadeIn}>
                <T variant="quote" style={{ marginTop: space.md }}>
                  “{daily.affirmation}”
                </T>
              </Animated.View>
            ) : (
              <View style={{ marginTop: space.md, gap: 8 }}>
                <View style={{ height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.5)', width: '90%' }} />
                <View style={{ height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.5)', width: '60%' }} />
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Today's focus */}
        {daily && (
          <Animated.View entering={FadeInDown.delay(150).duration(500)}>
            <SectionTitle title="Today’s focus" />
            <Card style={{ gap: space.md }}>
              <Row gap={space.md}>
                <Sol size={44} mood="happy" animated={false} />
                <View style={{ flex: 1 }}>
                  <T variant="subheading">{daily.focusTitle}</T>
                  <T variant="small" color={c.inkSoft}>
                    {daily.focusBody}
                  </T>
                </View>
              </Row>
              {daily.activity !== 'none' && <ActivityCard activity={daily.activity} compact />}
            </Card>
          </Animated.View>
        )}

        {/* Quick start */}
        <SectionTitle title="Quick start" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {QUICK.map((q, i) => {
            const a = accent(c, q.accent);
            return (
              <Animated.View key={q.title} entering={FadeInDown.delay(200 + i * 60)} style={{ width: '47.5%', flexGrow: 1 }}>
                <Tappable
                  onPress={() => router.push(q.href)}
                  style={{ backgroundColor: a.soft, borderRadius: radius.lg, padding: space.lg, gap: space.md }}
                  accessibilityHint={q.sub}
                >
                  <IconBadge icon={q.icon} bg={c.surface} fg={a.strong} size={38} />
                  <T variant="subheading">{q.title}</T>
                </Tappable>
              </Animated.View>
            );
          })}
        </View>

        {/* Continue conversation */}
        {data?.lastConversation && (
          <>
            <SectionTitle title="Pick up where you left off" />
            <Card onPress={() => router.push(`/chat/${data.lastConversation!.id}`)}>
              <Row gap={space.md}>
                <IconBadge icon="message-circle" bg={c.lavenderSoft} fg={c.primary} />
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong" numberOfLines={1}>
                    {data.lastConversation.title ?? 'Your last chat with Sol'}
                  </T>
                  <T variant="small" color={c.inkSoft}>
                    {new Date(data.lastConversation.updatedAt).toLocaleDateString(undefined, { weekday: 'long' })}
                  </T>
                </View>
                <Feather name="chevron-right" size={20} color={c.inkFaint} />
              </Row>
            </Card>
          </>
        )}

        {/* Garden progress */}
        {p && (
          <>
            <SectionTitle title="Pip’s garden" action="See journey" onAction={() => router.push('/journey')} />
            <Card onPress={() => router.push('/journey')}>
              <Row gap={space.md}>
                <Pip size={46} stage={pipStage} mood="calm" />
                <View style={{ flex: 1 }}>
                  <T variant="caption" color={c.inkSoft}>
                    Level {p.level}
                  </T>
                  <T variant="heading">{p.name}</T>
                </View>
                <T variant="small" color={c.inkSoft}>
                  {p.xp} XP
                </T>
              </Row>
              <View style={{ marginTop: space.md }}>
                <ProgressBar value={levelProgress} color={c.sage} track={c.sageSoft} height={10} />
              </View>
              <T variant="small" color={c.inkSoft} style={{ marginTop: space.sm }}>
                {p.nextLevelXp ? `${p.nextLevelXp - p.xp} XP until ${p.nextLevelName}` : 'Your garden is in full bloom'}
              </T>
            </Card>
          </>
        )}
      </ScrollView>
      <PipTour />
    </View>
  );
}
