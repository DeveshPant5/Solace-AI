import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { MicButton } from '@/components/MicButton';
import type { PipMood } from '@/components/Pip';
import { PipGuide } from '@/components/PipGuide';
import { Sol, type SolMood } from '@/components/Sol';
import { Button, Card, Chip, Header, inputStyle, ProgressBar, Row, Screen, T, Tappable, type IconName } from '@/components/ui';
import { FOCUS_AREAS } from '@/content/wellness';
import { useAuth } from '@/lib/auth';
import { helpWithIntention, helpWithTone, type IntentionHelp, type ToneHelp } from '@/lib/onboardingAssist';
import type { CheckinTime, Tone } from '@/lib/types';
import { stopSpeaking, useVoice } from '@/lib/voice';
import { radius, space, useTheme } from '@/theme';

const TIMES: { id: CheckinTime; label: string; detail: string; icon: IconName }[] = [
  { id: 'morning', label: 'Morning', detail: 'Around 9 AM', icon: 'sunrise' },
  { id: 'afternoon', label: 'Afternoon', detail: 'Around 2 PM', icon: 'sun' },
  { id: 'evening', label: 'Evening', detail: 'Around 8 PM', icon: 'sunset' },
  { id: 'night', label: 'Before bed', detail: 'Around 10 PM', icon: 'moon' },
];

const TONES: { id: Tone; label: string; sample: string; mood: SolMood }[] = [
  { id: 'gentle', label: 'Gentle', sample: 'That sounds like a lot to hold. I’m here, take your time.', mood: 'calm' },
  { id: 'cheerful', label: 'Cheerful', sample: 'You showed up today, and that matters! What’s on your mind?', mood: 'joyful' },
  { id: 'direct', label: 'Direct', sample: 'Let’s look at what’s stressing you and pick one thing to tackle.', mood: 'thinking' },
];

const STEPS = 5;

/** "My name is Devesh" → "Devesh". Keeps whatever was said if there's no lead-in. */
function nameFromSpeech(said: string) {
  const m = said.match(/(?:my name is|my name's|i am|i'm|call me|it's|its|this is)\s+(.+)/i);
  const raw = (m?.[1] ?? said).replace(/[.!?,]+$/g, '').trim();
  return raw
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Personalize() {
  const c = useTheme();
  const { saveOnboarding, onboarding } = useAuth();
  const { speaking } = useVoice();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(onboarding?.name ?? '');
  const [intention, setIntention] = useState(onboarding?.intention ?? '');
  const [focus, setFocus] = useState<string[]>(onboarding?.focus ?? []);
  const [time, setTime] = useState<CheckinTime>(onboarding?.checkinTime ?? 'evening');
  const [tone, setTone] = useState<Tone>(onboarding?.tone ?? 'gentle');

  // Pip's help. All of it is optional and never blocks moving on.
  const [help, setHelp] = useState<IntentionHelp | null>(null);
  const [helpFor, setHelpFor] = useState('');
  const [helping, setHelping] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [focusTouched, setFocusTouched] = useState(false);
  const [toneHelp, setToneHelp] = useState<ToneHelp | null>(null);
  const toneFor = useRef('');
  const request = useRef(0);
  const [listening, setListening] = useState(false);
  const dictationBase = useRef('');

  const firstName = name.trim().split(/\s+/)[0] ?? '';

  const quiet = () => {
    if (speaking) stopSpeaking();
  };

  const askPip = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (text.length < 8 || text === helpFor) return;
      const id = ++request.current;
      setHelping(true);
      const r = await helpWithIntention({ name: firstName || undefined, text, focus });
      if (id !== request.current) return;
      setHelping(false);
      if (!r) return;
      setHelp(r);
      setHelpFor(text);
      setSuggested(r.focus);
      if (!focusTouched && r.focus.length) setFocus((f) => [...new Set([...f, ...r.focus])]);
    },
    [helpFor, firstName, focus, focusTouched],
  );

  // Quiet, passive help: once they pause typing, Pip offers a few ways to say it.
  useEffect(() => {
    if (step !== 1 || listening) return;
    const t = setTimeout(() => void askPip(intention), 1800);
    return () => clearTimeout(t);
  }, [intention, step, listening, askPip]);

  // Get Sol's sample replies ready while they pick focus areas and a time.
  const prepareTones = () => {
    const text = intention.trim();
    if (!text || text === toneFor.current) return;
    toneFor.current = text;
    void helpWithTone({ name: firstName || undefined, text }).then((r) => {
      if (r && toneFor.current === text) setToneHelp(r);
    });
  };

  const toggle = (id: string) => {
    setFocusTouched(true);
    setFocus((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  };

  const next = async () => {
    stopSpeaking();
    if (step === 1) {
      void askPip(intention);
      prepareTones();
    }
    if (step < STEPS - 1) return setStep(step + 1);
    await saveOnboarding({ name: name.trim() || undefined, focus, intention: intention.trim() || undefined, checkinTime: time, tone });
    router.push('/sign-up');
  };

  const back = () => {
    stopSpeaking();
    if (step === 0) router.back();
    else setStep(step - 1);
  };

  const concern = step === 1 && help?.concern && helpFor === intention.trim();

  const pip: { line: string; mood: PipMood } = (() => {
    switch (step) {
      case 0:
        return { line: 'First things first. What would you like Sol and me to call you?', mood: 'curious' };
      case 1:
        if (concern && help) return { line: help.say, mood: 'listening' };
        return {
          line: `${firstName ? `Lovely to meet you, ${firstName}. ` : ''}What's been on your mind lately? Type it, or tap the mic and just tell me.`,
          mood: 'listening',
        };
      case 2:
        if (help?.say && !help.concern && suggested.length) return { line: help.say, mood: 'happy' };
        return { line: 'What would you like a little support with? Pick as many as you like.', mood: 'happy' };
      case 3:
        return { line: 'When would a gentle check-in suit you each day? Sol will send a soft nudge.', mood: 'calm' };
      default:
        return {
          line: toneHelp?.source === 'ai' ? "Last one. Here's how Sol might answer what you told me. Which feels right?" : 'Last one. How would you like Sol to talk with you?',
          mood: 'happy',
        };
    }
  })();

  const canContinue = step !== 0 || name.trim().length > 0;
  const showRephrasings = step === 1 && !!help && !help.concern && help.rephrasings.length > 0 && helpFor === intention.trim();

  return (
    <Screen>
      <Header onBack={back} title={`${step + 1} of ${STEPS}`} />
      <ProgressBar value={(step + 1) / STEPS} color={c.primary} track={c.line} height={6} />

      {/* Pip grows one stage with every step: sprout, seedling, bud, flower, sapling. */}
      <PipGuide layout="stack" line={pip.line} mood={pip.mood} size={100} stage={step + 1} growFrom={0} style={{ marginTop: space.xl }} />

      <Animated.View key={step} entering={FadeIn.duration(600).easing(Easing.out(Easing.sin))} style={{ marginTop: space.xl, gap: space.lg }}>
        {step === 0 && (
          <Row gap={space.sm}>
            <TextInput
              value={name}
              onChangeText={(v) => {
                quiet();
                setName(v);
              }}
              placeholder="Your first name"
              placeholderTextColor={c.inkFaint}
              style={[inputStyle(c), { flex: 1 }]}
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => canContinue && void next()}
              maxLength={60}
            />
            <MicButton size={52} mode="short" onText={(t) => setName(nameFromSpeech(t))} />
          </Row>
        )}

        {step === 1 && (
          <>
            <View>
              <TextInput
                value={intention}
                onChangeText={(v) => {
                  quiet();
                  setIntention(v);
                }}
                placeholder={listening ? 'Listening…' : 'e.g. exams are stressing me out and I can’t sleep'}
                placeholderTextColor={c.inkFaint}
                style={[inputStyle(c), { minHeight: 110, textAlignVertical: 'top', paddingRight: 64 }]}
                multiline
                maxLength={300}
              />
              <View style={{ position: 'absolute', right: 10, bottom: 10 }}>
                <MicButton
                  onListeningChange={(on) => {
                    if (on) dictationBase.current = intention.trim() ? `${intention.trim()} ` : '';
                    setListening(on);
                  }}
                  onText={(t, final) => {
                    const full = `${dictationBase.current}${t}`.slice(0, 300);
                    setIntention(full);
                    if (final) void askPip(full);
                  }}
                />
              </View>
            </View>

            {helping && (
              <Row gap={space.sm}>
                <ActivityIndicator size="small" color={c.sage} />
                <T variant="small" color={c.inkSoft}>
                  Pip is thinking…
                </T>
              </Row>
            )}

            {!helping && !showRephrasings && !concern && intention.trim().length >= 8 && helpFor !== intention.trim() && (
              <Tappable onPress={() => void askPip(intention)} style={{ alignSelf: 'flex-start' }} hitSlop={8}>
                <Row gap={6}>
                  <Feather name="feather" size={14} color={c.primary} />
                  <T variant="small" color={c.primary}>
                    Help me put it into words
                  </T>
                </Row>
              </Tappable>
            )}

            {showRephrasings && (
              <Animated.View entering={FadeIn.duration(700)} style={{ gap: space.sm }}>
                <T variant="caption" color={c.inkSoft}>
                  Or say it like this
                </T>
                {help!.rephrasings.map((r, i) => (
                  <Animated.View key={r} entering={FadeIn.delay(150 * i).duration(600)}>
                    <Tappable
                      onPress={() => {
                        setIntention(r);
                        setHelpFor(r);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        padding: space.md,
                        borderRadius: radius.md,
                        backgroundColor: c.butterSoft,
                      }}
                    >
                      <Feather name="corner-down-right" size={16} color={c.butter} />
                      <T variant="small" style={{ flex: 1 }}>
                        {r}
                      </T>
                    </Tappable>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {concern && (
              <Animated.View entering={FadeIn}>
                <Card style={{ backgroundColor: c.roseSoft, gap: space.md }}>
                  <T variant="bodyStrong">You don’t have to carry this alone.</T>
                  <T variant="small" color={c.inkSoft}>
                    If you’re thinking about hurting yourself or you’re not safe, please talk to someone right now. It’s free and confidential.
                  </T>
                  <Button title="See help lines" icon="phone" small onPress={() => router.push('/help')} />
                </Card>
              </Animated.View>
            )}

            <T variant="small" color={c.inkFaint}>
              Only Pip and Sol see this. It helps them understand where to start.
            </T>
          </>
        )}

        {step === 2 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {FOCUS_AREAS.map((f) => (
              <View key={f.id}>
                <Chip label={f.label} icon={f.icon} selected={focus.includes(f.id)} onPress={() => toggle(f.id)} />
                {suggested.includes(f.id) && (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', top: -6, right: -4, backgroundColor: c.sage, borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.surface }}
                    accessibilityLabel="Pip's pick"
                  >
                    <Feather name="feather" size={9} color="#FFFFFF" />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: space.sm }}>
            {TIMES.map((t) => {
              const active = time === t.id;
              return (
                <Tappable
                  key={t.id}
                  onPress={() => setTime(t.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    padding: space.lg,
                    borderRadius: radius.md,
                    backgroundColor: active ? c.primarySoft : c.surface,
                    borderWidth: 1.5,
                    borderColor: active ? c.primary : c.line,
                  }}
                >
                  <Feather name={t.icon} size={22} color={active ? c.primary : c.inkSoft} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong">{t.label}</T>
                    <T variant="small" color={c.inkSoft}>
                      {t.detail}
                    </T>
                  </View>
                  {active && <Feather name="check-circle" size={20} color={c.primary} />}
                </Tappable>
              );
            })}
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: space.md }}>
            {TONES.map((t) => {
              const active = tone === t.id;
              const preview = toneHelp?.previews[t.id] ?? t.sample;
              return (
                <Card
                  key={t.id}
                  onPress={() => setTone(t.id)}
                  style={{ borderWidth: 1.5, borderColor: active ? c.primary : 'transparent', backgroundColor: active ? c.primarySoft : c.surface }}
                >
                  <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                    <Sol size={52} mood={t.mood} animated={active} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T variant="subheading">{t.label}</T>
                      <Animated.View key={preview} entering={FadeIn.duration(400)}>
                        <T variant="small" color={c.inkSoft}>
                          “{preview}”
                        </T>
                      </Animated.View>
                    </View>
                  </Row>
                </Card>
              );
            })}
          </View>
        )}
      </Animated.View>

      <Button title={step < STEPS - 1 ? 'Continue' : 'Create my space'} onPress={() => void next()} disabled={!canContinue} style={{ marginTop: space.xxl }} />
      {(step === 1 || step === 2) && (
        <Button title="Skip for now" kind="ghost" onPress={() => void next()} style={{ marginTop: space.sm }} />
      )}
    </Screen>
  );
}
