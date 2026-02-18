// src/screens/MatchRecapScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveMatchToFirestore } from '../hooks/useSaveMatch';
import { getDisplayName } from '../utils/displayName';

type P = NativeStackScreenProps<AppStackParamList,'MatchRecap'>;

type Row = { id: string; points?: number; fouls?: number; blocks?: number };

export default function MatchRecapScreen({ route, navigation }: P) {
  const { stats = {}, name, place, format, playersA = [], playersB = [] } = (route.params ?? {}) as any;
  const rows: Row[] = Object.keys(stats).map(k => ({ id: k, ...(stats as any)[k] }));

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.navigate('Home')} style={s.backBtn} accessibilityLabel="Retour à l'accueil">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Accueil</Text>
        </Pressable>
      </View>

      <Text style={s.h}>Résultat du match</Text>
      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={s.card}>
            <Text style={s.title}>{getDisplayName(item.id)}</Text>
            <Text style={s.sub}>{item.points ?? 0} pts · {item.fouls ?? 0} fautes · {item.blocks ?? 0} blk</Text>
          </View>
        )}
      />

      <Pressable style={s.btn} onPress={async () => {
        try {
          await saveMatchToFirestore({
            name: name ?? 'Match',
            place: place ?? 'Terrain',
            format: format as any,
            playersA: playersA as any,
            playersB: playersB as any,
            stats: stats as any,
            ts: Date.now(),
          });
        } catch {}
        navigation.replace('Home');
      }}>
        <Text style={s.btnTxt}>Enregistrer</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  topbar: { paddingVertical: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  backTxt: { color: colors.text, fontWeight: '700' },
  h: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontWeight: '700' },
  sub: { color: colors.textDim, marginTop: 4 },
  btn: { backgroundColor: colors.brand, marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});

