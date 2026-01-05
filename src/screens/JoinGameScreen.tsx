// src/screens/JoinGameScreen.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useOpenMatches } from '../hooks/useMatches';
import { spacing, radius } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';

type P = NativeStackScreenProps<AppStackParamList, 'JoinGame'>;

export default function JoinGameScreen({ navigation }: P) {
  const [asReferee, setAsReferee] = useState(false);
  const { data: matches, loading } = useOpenMatches();

  const nameOf = (p: any) => {
  if (!p) return '—';
  if (typeof p === 'string') return p;
  return p.displayName || p.uid || '—';
};

  const handleJoin = (item: any) => {
    const params = {
      matchId: item.id,
      asReferee,
      name: nameOf(item.name),
      place: item.place,
      format: item.format,
    };

    if (asReferee) navigation.navigate('MatchSheet', params);
    else navigation.navigate('MatchViewer', params);
  };

  return (
    <View style={s.container}>
      {/* Top bar: Back to Home */}
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.navigate('Home')} style={s.backBtn} accessibilityLabel="Retour à l'accueil">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Accueil</Text>
        </Pressable>
      </View>

      <Text style={s.title}>Rejoindre une partie</Text>

      <Pressable style={s.toggle} onPress={() => setAsReferee((v) => !v)}>
        <Text style={s.toggleTxt}>
          {asReferee ? 'Mode arbitre activé' : 'Mode joueur'}
        </Text>
      </Pressable>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => handleJoin(item)}>
              <Text style={s.cardTitle}>{item.name}</Text>
              <Text style={s.cardSub}>
                {item.place} · {item.format}
              </Text>
              {item.description ? (
                <Text style={s.cardDesc} numberOfLines={2} ellipsizeMode="tail">
                  {item.description}
                </Text>
              ) : null}
              <Text style={s.cardSub}>
                A: {item.playersA?.length ?? 0} · B: {item.playersB?.length ?? 0}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  topbar:{ paddingVertical: 8 },
  backBtn:{ flexDirection:'row', alignItems:'center', gap:8 },
  backTxt:{ color: colors.text, fontWeight:'700' },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  toggle: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: spacing.lg,
  },
  toggleTxt: { color: colors.text, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    padding: spacing.lg,
  },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardSub: { color: colors.textDim, marginTop: 2 },
  cardDesc: { color: colors.textDim, marginTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

