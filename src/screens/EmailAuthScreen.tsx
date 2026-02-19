import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import colors from '../theme/colors';
import { useAuth } from '../hooks/useAuth';

const formatAuthError = (e: any) => {
  const code = String(e?.code ?? '');
  if (code === 'auth/invalid-email') return 'Email invalide.';
  if (code === 'auth/user-not-found') return 'Aucun compte trouve pour cet email.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Email ou mot de passe incorrect.';
  if (code === 'auth/too-many-requests') return 'Trop de tentatives. Reessaie plus tard.';
  if (code === 'auth/network-request-failed') return 'Probleme reseau. Verifie ta connexion.';
  if (code === 'auth/email-already-in-use') return 'Cet email est deja utilise.';
  if (code === 'auth/weak-password') return 'Mot de passe trop faible (6 caracteres minimum).';
  return String(e?.message ?? 'Erreur de connexion');
};

export default function EmailAuthScreen({ route }: any) {
  const defaultTab: 'login' | 'signup' = route?.params?.tab ?? 'login';
  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signInEmail, signUpEmail } = useAuth();

  // Keep button usable after any outcome by always resetting loading in finally.
  const onSubmit = async () => {
    if (loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      if (tab === 'login') {
        await signInEmail(email, pwd);
      } else {
        await signUpEmail(email, pwd, pseudo || undefined);
      }
    } catch (e: any) {
      setError(formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = useMemo(() => {
    const okMail = /\S+@\S+\.\S+/.test(email);
    const okPwd = pwd.length >= 6;
    if (tab === 'signup') return okMail && okPwd && pseudo.trim().length >= 2 && !loading;
    return okMail && okPwd && !loading;
  }, [email, pwd, pseudo, tab, loading]);
  let submitLabel = 'Creer un compte';
  if (loading) submitLabel = 'Connexion...';
  else if (tab === 'login') submitLabel = 'Se connecter';

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tabs */}
          <View style={s.tabs}>
            <Pressable style={[s.tab, tab === 'login' && s.tabActive]} onPress={() => setTab('login')}>
              <Text style={[s.tabTxt, tab === 'login' && s.tabTxtActive]}>Connexion</Text>
            </Pressable>
            <Pressable style={[s.tab, tab === 'signup' && s.tabActive]} onPress={() => setTab('signup')}>
              <Text style={[s.tabTxt, tab === 'signup' && s.tabTxtActive]}>Inscription</Text>
            </Pressable>
          </View>

          {tab === 'signup' && (
            <>
              <Text style={s.label}>Pseudo</Text>
              <TextInput
                style={s.input}
                value={pseudo}
                onChangeText={setPseudo}
                placeholder="Ton pseudo"
                placeholderTextColor={colors.textDim}
              />
            </>
          )}

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="email@exemple.com"
            placeholderTextColor={colors.textDim}
          />

          <Text style={s.label}>Mot de passe</Text>
          <TextInput
            style={s.input}
            secureTextEntry
            value={pwd}
            onChangeText={setPwd}
            placeholder="********"
            placeholderTextColor={colors.textDim}
          />

          {error ? <Text style={s.errorTxt}>{error}</Text> : null}

          <Pressable
            style={[s.btn, !canSubmit && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            <Text style={s.btnTxt}>{submitLabel}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#1a2230', borderColor: colors.brand },
  tabTxt: { color: colors.textDim, fontWeight: '700' },
  tabTxtActive: { color: colors.text },
  label: { color: colors.textDim, marginTop: 10 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorTxt: { color: '#ff6b6b', marginTop: 12, fontWeight: '600' },
  btn: {
    backgroundColor: colors.brand,
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnTxt: { color: '#fff', fontWeight: '800' },
});
