import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import colors from '../theme/colors';

export default function AuthLandingScreen({ navigation }: any) {
  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      <Text style={s.h}>Bienvenue</Text>
      <Text style={s.sub}>Connecte-toi pour créer ou rejoindre une partie</Text>

      <Pressable style={s.btnPrimary} onPress={()=>navigation.navigate('EmailAuth', { tab: 'login' })}>
        <Text style={s.btnTxt}>Se connecter</Text>
      </Pressable>
      <Pressable style={s.btnGhost} onPress={()=>navigation.navigate('EmailAuth', { tab: 'signup' })}>
        <Text style={s.btnGhostTxt}>Créer un compte</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:colors.bg, padding:20, justifyContent:'center' },
  h:{ color:colors.text, fontSize:28, fontWeight:'800', marginBottom:8 },
  sub:{ color:colors.textDim, marginBottom:24 },
  btnPrimary:{ backgroundColor:colors.brand, paddingVertical:14, borderRadius:12, alignItems:'center', marginTop:8 },
  btnTxt:{ color:'#fff', fontWeight:'800' },
  btnGhost:{ borderColor:colors.border, borderWidth:1, paddingVertical:14, borderRadius:12, alignItems:'center', marginTop:12, backgroundColor:colors.card },
  btnGhostTxt:{ color:colors.text, fontWeight:'700' },
});
