import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';

import { ActivityCard } from '@/components/ActivityCard';
import { PipTip } from '@/components/PipTip';
import { Sol } from '@/components/Sol';
import { Button, Card, ErrorNote, Header, Pill, ProgressBar, Row, Screen, T, Tappable } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import type { AssessmentDef, AssessmentResult } from '@/lib/types';
import { accent, radius, space, useTheme, type Accent } from '@/theme';

const ACCENTS: Record<AssessmentDef['kind'], Accent> = { mood: 'peach', anxiety: 'sky', kindness: 'rose' };
const BAND_ACCENT: Record<AssessmentResult['band'], Accent> = { steady: 'sage', mild: 'butter', moderate: 'peach', high: 'rose' };

let catalogCache: AssessmentDef[] | null = null;

export default function Assessment() {
  const c = useTheme();
  const { kind } = useLocalSearchParams<{ kind: AssessmentDef['kind'] }>();
  const [def, setDef] = useState<AssessmentDef | null>(catalogCache?.find((a) => a.kind === kind) ?? null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ result: AssessmentResult; xp: number } | null>(null);

  useEffect(() => {
    if (def) return;
    api<{ assessments: AssessmentDef[] }>('/assessments/catalog')
      .then((r) => {
        catalogCache = r.assessments;
        setDef(r.assessments.find((a) => a.kind === kind) ?? null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [def, kind]);

  const a = accent(c, ACCENTS[kind ?? 'mood'] ?? 'lavender');

  const submit = async (all: number[]) => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await api<{ result: AssessmentResult; xp: number }>('/assessments', { body: { kind, answers: all } });
      haptic.success();
      setResult(r);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const choose = (option: number) => {
    if (!def) return;
    haptic.tap();
    const next = [...answers.slice(0, index), option];
    setAnswers(next);
    setTimeout(() => {
      if (index + 1 < def.questions.length) setIndex(index + 1);
      else void submit(next);
    }, 220);
  };

  if (result) {
    const r = result.result;
    const ba = accent(c, BAND_ACCENT[r.band]);
    return (
      <Screen>
        <Header title={r.title} onBack={() => router.back()} />
        <Animated.View entering={FadeIn} style={{ alignItems: 'center', gap: space.sm }}>
          <Sol size={120} mood={r.band === 'high' ? 'concerned' : r.band === 'steady' ? 'joyful' : 'calm'} />
          <T variant="caption" color={c.inkSoft}>
            Your snapshot
          </T>
          <T variant="title" center>
            {r.label}
          </T>
          <T variant="body" color={c.inkSoft} center style={{ maxWidth: 320 }}>
            {r.summary}
          </T>
          <Pill text={`+${result.xp} XP`} icon="star" bg={c.butterSoft} fg={c.ink} />
        </Animated.View>

        <Card style={{ marginTop: space.xl, gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="small" color={c.inkSoft}>
              Score
            </T>
            <T variant="bodyStrong">
              {r.score} / {r.maxScore}
            </T>
          </Row>
          <ProgressBar value={r.score / r.maxScore} color={ba.strong} track={ba.soft} height={10} />
          <T variant="small" color={c.inkFaint} style={{ fontSize: 12 }}>
            This isn’t a diagnosis, just how things look right now. If something feels heavy, talking to someone can help.
          </T>
        </Card>

        {r.band === 'high' && (
          <View style={{ marginTop: space.lg }}>
            <ActivityCard activity="help_now" reason="Free, confidential support whenever you need it." />
          </View>
        )}

        <T variant="heading" style={{ marginTop: space.xxl, marginBottom: space.md }}>
          Your next steps
        </T>
        <View style={{ gap: space.md }}>
          {r.moves?.map((m, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 120)}>
              {m.activity !== 'none' && m.activity !== 'help_now' ? (
                <View style={{ gap: space.xs }}>
                  <T variant="bodyStrong">
                    {i + 1}. {m.title}
                  </T>
                  <T variant="small" color={c.inkSoft} style={{ marginBottom: space.xs }}>
                    {m.body}
                  </T>
                  <ActivityCard activity={m.activity} compact />
                </View>
              ) : (
                <Card style={{ gap: 4 }}>
                  <T variant="bodyStrong">
                    {i + 1}. {m.title}
                  </T>
                  <T variant="small" color={c.inkSoft}>
                    {m.body}
                  </T>
                </Card>
              )}
            </Animated.View>
          ))}
        </View>
        <Button title="Done" onPress={() => router.back()} style={{ marginTop: space.xxl }} />
      </Screen>
    );
  }

  if (submitting) {
    return (
      <Screen scroll={false} contentStyle={{ alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Sol size={140} mood="thinking" />
        <T variant="heading" center>
          Luma is reading your answers…
        </T>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={def?.title}
        onBack={() => {
          if (index > 0) setIndex(index - 1);
          else router.back();
        }}
      />
      {index === 0 && <PipTip id="assessment" />}
      {error && <ErrorNote message={error} onRetry={answers.length === def?.questions.length ? () => submit(answers) : undefined} />}
      {def && (
        <>
          <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
            <T variant="caption" color={c.inkSoft}>
              Question {index + 1} of {def.questions.length}
            </T>
            <Pill text={`+${def.xpPerQuestion} XP each`} icon="star" bg={a.soft} fg={c.ink} />
          </Row>
          <ProgressBar value={index / def.questions.length} color={a.strong} track={a.soft} />
          <Animated.View key={index} entering={FadeInRight.duration(300)}>
            <Card tone={a.soft} style={{ marginTop: space.xl, gap: space.md }}>
              <T variant="small" color={c.inkSoft}>
                {def.intro}
              </T>
              <T variant="title">{def.questions[index]}</T>
            </Card>
            <View style={{ gap: space.sm, marginTop: space.xl }}>
              {def.options.map((label, i) => {
                const selected = answers[index] === i;
                return (
                  <Tappable
                    key={label}
                    onPress={() => choose(i)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: space.lg,
                      borderRadius: radius.md,
                      backgroundColor: selected ? a.soft : c.surface,
                      borderWidth: 1.5,
                      borderColor: selected ? a.strong : c.line,
                    }}
                  >
                    <T variant="bodyStrong">{label}</T>
                    {selected && <Feather name="check" size={18} color={c.ink} />}
                  </Tappable>
                );
              })}
            </View>
          </Animated.View>
        </>
      )}
    </Screen>
  );
}
