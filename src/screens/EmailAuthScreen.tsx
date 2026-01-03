import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import colors from '../theme/colors';
import { useAuth } from '../hooks/useAuth';

export default function EmailAuthScreen({ route, navigation }: any) {
  const defaultTab: 'login'|'signup' = route?.params?.tab ?? 'login';
  const [tab, setTab] = useState<'login'|'signup'>(defaultTab);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signInEmail, signUpEmail } = useAuth();

  const onSubmit = async () => {
    setLoading(true); setError('');
    try {
      if (tab === 'login') {
        await signInEmail(email, pwd);
      } else {
        await signUpEmail(email, pwd, pseudo || undefined);
      }
    } catch (e:any) {
      setError(e?.message ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = useMemo(() => {
    const okMail = /\S+@\S+\.\S+/.test(email);
    const okPwd = pwd.length >= 6;
    if (tab === 'signup') return okMail && okPwd && (pseudo.trim().length >= 2) && !loading;
    return okMail && okPwd && !loading;
  }, [email, pwd, pseudo, tab, loading]);

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      {/* Tabs */}
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab==='login' && s.tabActive]} onPress={()=>setTab('login')}>
          <Text style={[s.tabTxt, tab==='login' && s.tabTxtActive]}>Connexion</Text>
        </Pressable>
        <Pressable style={[s.tab, tab==='signup' && s.tabActive]} onPress={()=>setTab('signup')}>
          <Text style={[s.tabTxt, tab==='signup' && s.tabTxtActive]}>Inscription</Text>
        </Pressable>
      </View>

      {tab==='signup' && (
        <>
          <Text style={s.label}>Pseudo</Text>
          <TextInput style={s.input} value={pseudo} onChangeText={setPseudo} placeholder="Ton pseudo" placeholderTextColor={colors.textDim}/>
        </>
      )}

      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail} placeholder="email@exemple.com" placeholderTextColor={colors.textDim}/>

      <Text style={s.label}>Mot de passe</Text>
      <TextInput style={s.input} secureTextEntry value={pwd} onChangeText={setPwd} placeholder="••••••••" placeholderTextColor={colors.textDim}/>

      <Pressable style={[s.btn, loading && { opacity:0.6 }]} onPress={onSubmit} disabled={loading}>
        <Text style={s.btnTxt}>{tab==='login' ? 'Se connecter' : 'Créer un compte'}</Text>
      </Pressable>

      {/* (Option) Bouton Google plus tard */}
      {/* <Pressable style={s.btnGoogle} onPress={promptGoogle}><Text style={s.btnGoogleTxt}>Se connecter avec Google</Text></Pressable> */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:colors.bg, padding:20 },
  tabs:{ flexDirection:'row', gap:8, marginBottom:16 },
  tab:{ flex:1, backgroundColor:colors.card, borderWidth:1, borderColor:colors.border, borderRadius:10, paddingVertical:10, alignItems:'center' },
  tabActive:{ backgroundColor:'#1a2230', borderColor:colors.brand },
  tabTxt:{ color:colors.textDim, fontWeight:'700' },
  tabTxtActive:{ color:colors.text },
  label:{ color:colors.textDim, marginTop:10 },
  input:{ backgroundColor:colors.card, color:colors.text, borderRadius:12, padding:12, marginTop:6, borderWidth:1, borderColor:colors.border },
  btn:{ backgroundColor:colors.brand, marginTop:18, paddingVertical:14, borderRadius:12, alignItems:'center' },
  btnTxt:{ color:'#fff', fontWeight:'800' },
  // btnGoogle:{ borderWidth:1, borderColor:colors.border, paddingVertical:14, borderRadius:12, alignItems:'center', marginTop:12, backgroundColor:colors.card },
  // btnGoogleTxt:{ color:colors.text, fontWeight:'700' },
});

