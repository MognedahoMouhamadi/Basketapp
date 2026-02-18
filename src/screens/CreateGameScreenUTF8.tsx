import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { spacing, radius } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { auth } from '../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { createMatch, MatchCategory, MatchVisibility } from '../services/matchService';

type P = NativeStackScreenProps<AppStackParamList, 'CreateGame'>;

export default function CreateGameScreenUTF8({ navigation }: P) {
  const [name, setName] = useState('Pickup Game');
  const [place, setPlace] = useState('Terrain local');
  const [city, setCity] = useState('');
  const [format, setFormat] = useState<'3v3' | '4v4' | '5v5'>('3v3');
  const [category, setCategory] = useState<MatchCategory>('public');
  const [tournamentId, setTournamentId] = useState<string>('');
  const [asReferee, setAsReferee] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit =
    name.trim().length > 1 &&
    place.trim().length > 1 &&
    city.trim().length > 1 &&
    !busy;

  const onContinue = async () => {
    if (!canSubmit) return;
    const u = auth.currentUser;
    if (!u) {
      Alert.alert('Connexion requise', 'Connecte-toi pour créer une partie.');
      return;
    }
    try {
      setBusy(true);

      if (category === 'tournament' && !tournamentId.trim()) {
        Alert.alert('Tournoi requis', 'Sélectionne un tournoi pour créer ce match.');
        return;
      }

      const visibility: MatchVisibility =
        category === 'tournament' ? 'tournament' : (isOpen ? 'public' : 'private');

      const id = await createMatch({
        category,
        creatorId: u.uid,
        tournamentId: category === 'tournament' ? tournamentId.trim() : undefined,
        name: name?.trim() ?? null,
        place: place?.trim() ?? null,
        city: city?.trim() ?? null,
        format: format ?? '3v3',
        description: comment.trim(),
        visibility,
      });

      navigation.replace('MatchSheet', {
        matchId: id,
        asReferee: category === 'ranked' ? true : asReferee,
        name: name.trim(),
        place: place.trim(),
        format,
        playersA: [],
        playersB: [],
      });
    } catch (e: any) {
      console.error('CreateGame error:', e?.code, e?.message, e);
      Alert.alert('Erreur', e?.message ?? 'Impossible de créer la partie.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      <Pressable onPress={() => navigation.goBack()} style={s.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
        <Text style={s.backTxt}>Retour</Text>
      </Pressable>

      <Text style={s.h}>Créer une partie</Text>

      <Text style={s.label}>Nom</Text>
      <TextInput style={s.input} value={name} onChangeText={setName}
        placeholder="Nom de la partie" placeholderTextColor={colors.textDim}/>

      <Text style={s.label}>Lieu</Text>
      <TextInput style={s.input} value={place} onChangeText={setPlace}
        placeholder="Lieu" placeholderTextColor={colors.textDim}/>

      <Text style={s.label}>Ville</Text>
      <TextInput style={s.input} value={city} onChangeText={setCity}
        placeholder="Ville" placeholderTextColor={colors.textDim}/>


      <Text style={s.label}>Format</Text>
      <View style={s.row}>
        {(['3v3','4v4','5v5'] as const).map(f=>(
          <Pressable key={f} onPress={()=>setFormat(f)} style={[s.chip, format===f && s.chipSel]}>
            <Text style={[s.chipTxt, format===f && s.chipTxtSel]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Catégorie</Text>
      <View style={s.row}>
        {([
          { key: 'public', label: 'Public' },
          { key: 'ranked', label: 'Classée' },
          { key: 'tournament', label: 'Tournoi' },
        ] as const).map(opt => (
          <Pressable key={opt.key} onPress={()=>setCategory(opt.key as any)} style={[s.chip, category===opt.key && s.chipSel]}>
            <Text style={[s.chipTxt, category===opt.key && s.chipTxtSel]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {category === 'tournament' && (
        <>
          <Text style={s.label}>ID du tournoi</Text>
          <TextInput style={s.input} value={tournamentId} onChangeText={setTournamentId}
            placeholder="tournamentId" placeholderTextColor={colors.textDim}/>
        </>
      )}

      {category !== 'ranked' && (
        <View style={s.optRow}>
          <Text style={s.optTxt}>Je suis arbitre</Text>
          <Switch value={asReferee} onValueChange={setAsReferee}
            thumbColor={asReferee ? colors.brand : '#888'}
            trackColor={{ false: colors.border, true: colors.brand }} />
        </View>
      )}
      <View style={s.optRow}>
        <Text style={s.optTxt}>Partie listable</Text>
        <Switch value={isOpen} onValueChange={setIsOpen}
          thumbColor={isOpen ? colors.brand : '#888'}
          trackColor={{ false: colors.border, true: colors.brand }} />
      </View>

      <Text style={s.label}>Commentaire (optionnel)</Text>
      <TextInput
        style={[s.input, { height: 80, textAlignVertical: 'top' }]}
        multiline value={comment} onChangeText={setComment}
        placeholder="Annonce, règle spéciale, etc."
        placeholderTextColor={colors.textDim}
      />

      <Pressable style={[s.btn, !canSubmit && { opacity: 0.6 }]} onPress={onContinue} disabled={!canSubmit}>
        <Text style={s.btnTxt}>{busy ? '...' : 'Continuer'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:colors.bg, padding:spacing.xxl },
  back:{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:spacing.md },
  backTxt:{ color: colors.text, fontSize:16 },
  h:{ color:colors.text, fontSize:22, fontWeight:'700', marginBottom:spacing.lg },
  label:{ color:colors.textDim, marginTop:spacing.md },
  input:{ backgroundColor:colors.card, color:colors.text, borderRadius:radius.xl, padding:12, marginTop:6, borderWidth:1, borderColor:colors.border },
  row:{ flexDirection:'row', gap:8, marginTop:8 },
  chip:{ borderWidth:1, borderColor:colors.border, borderRadius:999, paddingVertical:8, paddingHorizontal:12 },
  chipSel:{ borderColor:colors.brand, backgroundColor:'#0000' },
  chipTxt:{ color:colors.textDim },
  chipTxtSel:{ color:colors.brand, fontWeight:'600' },
  optRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:spacing.lg },
  optTxt:{ color:colors.text },
  btn:{ backgroundColor:colors.brand, marginTop:spacing.xl, paddingVertical:14, borderRadius:radius.xl, alignItems:'center' },
  btnTxt:{ color:'#fff', fontWeight:'700' },
});

