import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { ONBOARDING_LAST_STAGE } from '@/components/Pip';
import { PipGuide } from '@/components/PipGuide';
import { Button, ErrorNote, Header, inputStyle, Row, Screen, T } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { space, useTheme } from '@/theme';

export default function SignUp() {
  const c = useTheme();
  const { signUp, onboarding } = useAuth();
  const [name, setName] = useState(onboarding?.name ?? '');
  const first = onboarding?.name?.trim().split(/\s+/)[0];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError('Please tell us what to call you.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Please enter a valid email.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      haptic.success();
    } catch (e) {
      setError(errorMessage(e));
      haptic.warning();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header />
      <PipGuide
        line={`Almost there${first ? `, ${first}` : ''}. Make an account so Sol can remember what matters to you. It stays private.`}
        layout="stack"
        mood="happy"
        stage={ONBOARDING_LAST_STAGE}
        growFrom={ONBOARDING_LAST_STAGE - 1}
        size={100}
        style={{ marginBottom: space.xxl }}
      />

      <View style={{ gap: space.md }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="What should Sol call you?"
          placeholderTextColor={c.inkFaint}
          style={inputStyle(c)}
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          maxLength={60}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={c.inkFaint}
          style={inputStyle(c)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (8+ characters)"
            placeholderTextColor={c.inkFaint}
            style={[inputStyle(c), { paddingRight: 52 }]}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            textContentType="newPassword"
            onSubmitEditing={submit}
          />
          <Feather
            name={showPassword ? 'eye-off' : 'eye'}
            size={20}
            color={c.inkFaint}
            onPress={() => setShowPassword((s) => !s)}
            style={{ position: 'absolute', right: 16, top: 15 }}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          />
        </View>
        {error && <ErrorNote message={error} />}
        <Button title="Create account" onPress={submit} loading={busy} style={{ marginTop: space.sm }} />
      </View>

      <Row style={{ justifyContent: 'center', marginTop: space.xl }} gap={6}>
        <T variant="small" color={c.inkSoft}>
          Already have an account?
        </T>
        <Link href="/sign-in" replace>
          <T variant="small" color={c.primary}>
            Sign in
          </T>
        </Link>
      </Row>
    </Screen>
  );
}
