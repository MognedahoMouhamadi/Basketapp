// src/screens/auth/SignupScreen.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '../../components/ui/Input';
import PrimaryButton from '../../components/ui/PrimaryButton';
import colors from '../../theme/colors';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../services/firebase';          // ✅ au lieu de ../module/auth/AuthProvider
import { db } from '../../services/firebase';            // ✅ db vient aussi d’ici
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius } from '../../theme/tokens';





export default function SignupScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [isReferee, setIsReferee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(
    () => /\S+@\S+\.\S+/.test(email) && pwd.length >= 6 && pwd === pwd2 && !busy,
    [email, pwd, pwd2, busy]
  );

  const onSignup = async () => {
    if (!canSubmit) return;
    setBusy(true); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pwd);
      await updateProfile(cred.user, { displayName: email.split('@')[0] });
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: cred.user.email,
        displayName: cred.user.displayName,
        role: isReferee ? 'referee' : 'player',
        createdAt: serverTimestamp(),
        isActive: true,
        defaultPlayerId: null,
      });
      // AuthProvider bascule vers le stack privé
    } catch (e: any) {
      setError(e?.message ?? "Erreur d'inscription");
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex:1, backgroundColor: colors.bg, padding: spacing.xxl }}>
      <Pressable onPress={() => navigation.goBack()} style={{ marginBottom: spacing.md, flexDirection:'row', alignItems:'center', gap:8 }}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={{ color: colors.text, fontSize:18 }}>S’inscrire</Text>
      </Pressable>

      <View style={{
        backgroundColor: colors.card, borderRadius: radius.xl, borderWidth:1, borderColor: colors.border,
        padding: spacing.xxl, gap: spacing.lg
      }}>
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="votre@email.com" keyboardType="email-address" />
        <Input label="Mot de passe" value={pwd} onChangeText={setPwd} placeholder="••••••••" secureTextEntry />
        <Input label="Confirmer le mot de passe" value={pwd2} onChangeText={setPwd2} placeholder="••••••••" secureTextEntry />

        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={{ color: colors.text }}>Je suis arbitre</Text>
          <Switch
            value={isReferee}
            onValueChange={setIsReferee}
            thumbColor={isReferee ? colors.brand : '#888'}
            trackColor={{ false: colors.border, true: colors.brand }}
          />
        </View>

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        <PrimaryButton title={busy ? '...' : "S’inscrire"} onPress={onSignup} disabled={!canSubmit} />
      </View>

      <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: spacing.xl, alignItems:'center' }}>
        <Text style={{ color: colors.primary, fontWeight:'600' }}>Déjà un compte ? Se connecter</Text>
      </Pressable>
    </View>
  );
}

