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
      <T variant="body" color={c.inkSoft} style={{ marginTop: 4 }}>
        Small things that help, whenever you need them.
      </T>
      <PipTip id="practices" style={{ marginTop: space.xl, marginBottom: 0 }} />

      <SectionTitle title="Breathe & ground" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md, paddingRight: space.xl }} style={{ marginHorizontal: -space.xl, paddingLeft: space.xl }}>
        {BREATHING.map((id, i) => {
          const info = ACTIVITY_INFO[id as keyof typeof ACTIVITY_INFO];
          const a = accent(c, info.accent);
          return (
            <Animated.View key={id} entering={FadeInDown.delay(i * 60)}>
              <Tappable onPress={() => router.push(info.href)} style={{ width: 150, height: 170, borderRadius: radius.lg, backgroundColor: a.soft, padding: space.lg, justifyContent: 'space-between' }}>
                <IconBadge icon={info.icon} bg={c.surface} fg={a.strong} />
                <View>
                  <T variant="subheading">{info.title}</T>
                  <T variant="small" color={c.inkSoft}>
                    {info.subtitle}
                  </T>
                </View>
              </Tappable>
            </Animated.View>
          );
        })}
      </ScrollView>

      <SectionTitle title="Wellbeing check-ins" />
      <T variant="small" color={c.inkSoft} style={{ marginTop: -space.sm, marginBottom: space.md }}>
        Short, gentle check-ins. Each one earns XP. These aren’t diagnoses, just a snapshot.
      </T>
      <View style={{ gap: space.md }}>
        {CHECKS.map((check) => {
          const info = ACTIVITY_INFO[check.id as keyof typeof ACTIVITY_INFO];
          const a = accent(c, info.accent);
          const last = latest(check.kind);
          return (
            <Card key={check.kind} onPress={() => router.push(info.href)} tone={a.soft} style={{ gap: space.sm }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="heading">{info.title}</T>
                {last ? <Pill text={last.label} bg={c.surface} fg={c.ink} /> : <Pill text="New" bg={c.surface} fg={a.strong} />}
              </Row>
              <T variant="small" color={c.inkSoft}>
                {check.blurb}
              </T>
              <Row style={{ justifyContent: 'space-between', marginTop: space.xs }}>
                <Row gap={6}>
                  <Feather name="star" size={13} color={c.inkSoft} />
                  <T variant="small" color={c.inkSoft} style={{ fontSize: 12 }}>
                    +2 XP per question · +20 bonus
                  </T>
                </Row>
                {last && (
                  <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
                    Last: {relativeDay(last.createdAt)}
                  </T>
                )}
              </Row>
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
            <View style={{ flex: 1 }}>
              <T variant="bodyStrong">Write in your journal</T>
              <T variant="small" color={c.inkSoft}>
                A prompt to get you started, or a blank page
              </T>
            </View>
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
