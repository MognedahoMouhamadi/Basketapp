import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from '../../components/ui/Input';               // ✅ chemin corrigé
import PrimaryButton from '../../components/ui/PrimaryButton'; // ✅ chemin corrigé
import colors from '../../theme/colors';                      // ✅ chemin corrigé
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';         // ✅ ton AuthProvider exporte 'auth'

export default function AuthScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = email.includes('@') && password.length >= 6;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigation.replace('Home');
    } catch (e: any) {
      setError(e.message || 'Erreur de connexion');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
        Se connecter
      </Text>

      <View
        style={{
          backgroundColor: colors.card,
          padding: 24,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="votre@email.com"
          keyboardType="email-address"
        />

        <Input
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        {error ? (
          <Text style={{ color: 'tomato', fontSize: 13, marginTop: 4 }}>{error}</Text>
        ) : null}

        <PrimaryButton
          title={busy ? 'Connexion...' : 'Se connecter'}
          onPress={handleLogin}
          disabled={!canSubmit || busy}
        />

        <Pressable onPress={() => navigation.navigate('Signup')}>
          <Text
            style={{
              textAlign: 'center',
              marginTop: 8,
              color: colors.brand,
              fontWeight: '600',
            }}
          >
            Créer un compte
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
