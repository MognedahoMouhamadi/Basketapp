// src/screens/auth/LoginScreen.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '../../components/ui/Input';               // ✅ chemin corrigé
import PrimaryButton from '../../components/ui/PrimaryButton'; // ✅ chemin corrigé
import colors from '../../theme/colors';                      // ✅ chemin corrigé

import { auth } from '../../services/firebase';         // ✅ ton AuthProvider exporte 'auth'

import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../../theme/tokens';

// en haut du fichier
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';



export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(
    () => /\S+@\S+\.\S+/.test(email) && pwd.length >= 6 && !busy,
    [email, pwd, busy]
  );

  const onLogin = async () => {
    if (!canSubmit) return;
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pwd);
      // redirection gérée par AuthProvider (stack privé)
    } catch (e: any) {
      setError(e?.message ?? 'Erreur de connexion');
    } finally { setBusy(false); }
  };

  const onForgot = async () => {
    if (!email) { setError("Entre d'abord ton email pour recevoir le lien."); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setError('Email de réinitialisation envoyé ✅');
    } catch (e: any) {
      setError(e?.message ?? 'Impossible d’envoyer l’email.');
    }
  };
  const errorColor = error.includes('envoyé') ? colors.textDim : colors.danger;

  return (
    <View style={{ flex:1, backgroundColor: colors.bg, padding: spacing.xxl }}>
      {/* Header simple avec flèche retour */}
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md, flexDirection:'row', alignItems:'center', gap:8 }}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={{ color: colors.text, fontSize:18 }}>Se connecter</Text>
      </Pressable>

      {/* Card */}
      <View style={{
        backgroundColor: colors.card, borderRadius: radius.xl, borderWidth:1, borderColor: colors.border,
        padding: spacing.xxl, gap: spacing.lg
      }}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="votre@email.com"
          keyboardType="email-address"
        />
        <Input
          label="Mot de passe"
          value={pwd}
          onChangeText={setPwd}
          placeholder="••••••••"
          secureTextEntry
        />

        <Pressable onPress={onForgot}>
          <Text style={{ color: colors.primary, marginTop: spacing.xs }}>Mot de passe oublié ?</Text>
        </Pressable>

        {error ? <Text style={{ color: errorColor }}>{error}</Text> : null}

        <PrimaryButton title={busy ? '...' : 'Se connecter'} onPress={onLogin} disabled={!canSubmit} />
      </View>

      <Pressable onPress={() => navigation.navigate('Signup')} style={{ marginTop: spacing.xl, alignItems:'center' }}>
        <Text style={{ color: colors.primary, fontWeight:'600' }}>Créer un compte</Text>
      </Pressable>
    </View>
  );
}
