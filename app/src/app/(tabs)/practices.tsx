import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PipTip } from '@/components/PipTip';
import { Card, IconBadge, Pill, Row, Screen, SectionTitle, T, Tappable } from '@/components/ui';
import { ACTIVITY_INFO } from '@/content/activities';
import type { ActivityId, AssessmentResult } from '@/lib/types';
import { relativeDay } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import { accent, radius, space, useTheme } from '@/theme';

const BREATHING: ActivityId[] = ['breathing_calm', 'breathing_box', 'breathing_478', 'grounding'];
const CHECKS: { kind: AssessmentResult['kind']; id: ActivityId; blurb: string }[] = [
  { kind: 'mood', id: 'assessment_mood', blurb: 'How your mood has been over the last two weeks.' },
  { kind: 'anxiety', id: 'assessment_anxiety', blurb: 'How much worry has been showing up lately.' },
  { kind: 'kindness', id: 'assessment_kindness', blurb: 'How you’ve been talking to yourself this week.' },
];
const GUIDES: ActivityId[] = ['guide_anxiety', 'guide_low_mood', 'guide_stress', 'guide_sleep', 'guide_self_esteem', 'guide_mindfulness'];

export default function Practices() {
  const c = useTheme();
  const { data } = useApi<{ results: AssessmentResult[] }>('/assessments');
  const latest = (kind: string) => data?.results.find((r) => r.kind === kind);

  return (
    <Screen tabBar>
      <T variant="title">Practices</T>
      <PipTip id="practices" style={{ marginTop: space.xl, marginBottom: 0 }} />

      <SectionTitle title="Breathe & ground" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.xl, alignItems: 'stretch' }} style={{ marginHorizontal: -space.xl, paddingLeft: space.xl }}>
        {BREATHING.map((id, i) => {
          const info = ACTIVITY_INFO[id as keyof typeof ACTIVITY_INFO];
          const a = accent(c, info.accent);
          return (
            <Animated.View key={id} entering={FadeInDown.delay(i * 60)} style={{ flexDirection: 'row' }}>
              <Tappable onPress={() => router.push(info.href)} style={{ flex: 1, width: 140, borderRadius: radius.lg, backgroundColor: a.soft, padding: space.lg, gap: space.md }}>
                <IconBadge icon={info.icon} bg={c.surface} fg={a.strong} />
                <View style={{ gap: 2 }}>
                  <T variant="subheading">{info.title}</T>
                  <T variant="small" color={c.inkSoft} numberOfLines={1}>
                    {info.subtitle}
                  </T>
                </View>
              </Tappable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <SectionTitle title="Wellbeing check-ins" />
      <View style={{ gap: space.md }}>
        {CHECKS.map((check) => {
          const info = ACTIVITY_INFO[check.id as keyof typeof ACTIVITY_INFO];
          const a = accent(c, info.accent);
          const last = latest(check.kind);
          return (
            <Card key={check.kind} onPress={() => router.push(info.href)} tone={a.soft} style={{ gap: space.xs }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="heading">{info.title}</T>
                {last && <Pill text={last.label} bg={c.surface} fg={c.ink} />}
              </Row>
              {last && (
                <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
                  Last: {relativeDay(last.createdAt)}
                </T>
              )}
            </Card>
          );
        })}
      </View>

      <SectionTitle title="Guides" />
      <View style={{ gap: space.sm }}>
        {GUIDES.map((id) => {
          const info = ACTIVITY_INFO[id as keyof typeof ACTIVITY_INFO];
          const a = accent(c, info.accent);
          return (
            <Card key={id} onPress={() => router.push(info.href)} style={{ padding: space.lg }}>
              <Row gap={space.md}>
                <IconBadge icon={info.icon} bg={a.soft} fg={a.strong} />
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{info.title}</T>
                  <T variant="small" color={c.inkSoft}>
                    {info.subtitle}
                  </T>
                </View>
                <Feather name="chevron-right" size={20} color={c.inkFaint} />
              </Row>
            </Card>
          );
        })}
      </View>

      <SectionTitle title="Reflect" />
      <View style={{ gap: space.sm }}>
        <Card onPress={() => router.push('/journal/new')} tone={c.butterSoft}>
          <Row gap={space.md}>
            <IconBadge icon="feather" bg={c.surface} fg={c.butter} />
            <T variant="bodyStrong" style={{ flex: 1 }}>
              Write in your journal
            </T>
          </Row>
        </Card>
        <Card onPress={() => router.push('/journal')} style={{ padding: space.lg }}>
          <Row gap={space.md}>
            <IconBadge icon="book-open" bg={c.sunken} fg={c.inkSoft} />
            <T variant="bodyStrong" style={{ flex: 1 }}>
              Past entries
            </T>
            <Feather name="chevron-right" size={20} color={c.inkFaint} />
          </Row>
        </Card>
      </View>

      <SectionTitle title="Support" />
      <Card onPress={() => router.push('/help')} tone={c.roseSoft}>
        <Row gap={space.md}>
          <IconBadge icon="life-buoy" bg={c.surface} fg={c.danger} />
          <View style={{ flex: 1 }}>
            <T variant="bodyStrong">Need to talk to someone now?</T>
            <T variant="small" color={c.inkSoft}>
              Free, confidential helplines
            </T>
          </View>
          <Feather name="chevron-right" size={20} color={c.inkFaint} />
        </Row>
      </Card>
    </Screen>
  );
}
