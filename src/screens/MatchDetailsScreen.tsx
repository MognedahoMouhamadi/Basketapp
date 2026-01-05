import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { useMatchDetails } from '../hooks/useMatchDetails';

type P = NativeStackScreenProps<AppStackParamList, 'MatchDetails'>;

export default function MatchDetailsScreen({ route, navigation }: P) {
  const { matchId } = route.params;
  const { match, teamA, teamB, loading, error } = useMatchDetails(matchId);

  const formatDate = (val: any) => {
    const ts = val?.toMillis?.() ?? val ?? null;
    if (!ts) return '-';
    return new Date(ts).toLocaleDateString('fr-FR');
  };

  const categoryLabel = match?.category === 'ranked' ? 'Classé' : 'Public';
  const statusLabel = String(match?.status ?? 'finished');
  const scoreA = typeof match?.scoreA === 'number' ? match?.scoreA : 0;
  const scoreB = typeof match?.scoreB === 'number' ? match?.scoreB : 0;

  const winnerTeam = useMemo(() => {
    const raw = String(match?.winnerTeam ?? '').toUpperCase();
    if (raw === 'A' || raw === 'B') return raw;
    if (raw === 'DRAW' || raw === 'TIE' || raw === 'EGALITE') return 'DRAW';
    if (typeof match?.scoreA === 'number' && typeof match?.scoreB === 'number') {
      if (match.scoreA > match.scoreB) return 'A';
      if (match.scoreB > match.scoreA) return 'B';
      if (match.scoreA === match.scoreB) return 'DRAW';
    }
    return null;
  }, [match]);

  const winnerLabel = winnerTeam === 'A'
    ? 'Team A'
    : winnerTeam === 'B'
      ? 'Team B'
      : winnerTeam === 'DRAW'
        ? 'Egalite'
        : '-';

  const renderPlayerRow = (p: any) => {
    const name = String(p.displayName ?? p.uid ?? 'Joueur');
    const stats = p.stats ?? {};
    const pts = Number(stats.pts ?? stats.points ?? 0);
    const blocks = Number(stats.blocks ?? 0);
    const fouls = Number(stats.fouls ?? 0);
    const extras: string[] = [];
    if (typeof stats.twoPts === 'number') extras.push(`2PTS ${stats.twoPts}`);
    if (typeof stats.threePts === 'number') extras.push(`3PTS ${stats.threePts}`);
    return (
      <View key={p.uid} style={s.playerRow}>
        <View style={s.playerLeft}>
          <Text style={s.playerName}>{name}</Text>
          <Text style={s.playerMeta}>
            {pts} pts · {blocks} blk · {fouls} fautes
          </Text>
          {extras.length > 0 ? <Text style={s.playerMeta}>{extras.join(' · ')}</Text> : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
        <Text style={s.title}>Match details</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorTxt}>Erreur: {error.message ?? 'Impossible de charger le match.'}</Text>
        </View>
      ) : !match ? (
        <View style={s.center}>
          <Text style={s.emptyTxt}>Match introuvable.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.card}>
            <Text style={s.matchName}>{match.name ?? 'Match'}</Text>
            <Text style={s.matchMeta}>{match.place ?? '-'}</Text>
            <Text style={s.matchMeta}>{match.format ?? '-'}</Text>
            <Text style={s.matchMeta}>{formatDate(match.endedAt)}</Text>

            <View style={s.scoreRow}>
              <Text style={s.score}>{scoreA}</Text>
              <Text style={s.scoreSep}>:</Text>
              <Text style={s.score}>{scoreB}</Text>
            </View>

            <View style={s.badgeRow}>
              <View style={s.badge}><Text style={s.badgeTxt}>{categoryLabel}</Text></View>
              <View style={s.badge}><Text style={s.badgeTxt}>{statusLabel}</Text></View>
            </View>

            <Text style={s.winner}>Gagnant: {winnerLabel}</Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Team A</Text>
            {teamA.length === 0 ? (
              <Text style={s.emptyTxt}>Aucun joueur.</Text>
            ) : (
              teamA.map(renderPlayerRow)
            )}
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>Team B</Text>
            {teamB.length === 0 ? (
              <Text style={s.emptyTxt}>Aucun joueur.</Text>
            ) : (
              teamB.map(renderPlayerRow)
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: colors.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backTxt: { color: colors.text, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  errorTxt: { color: colors.textDim },
  emptyTxt: { color: colors.textDim },
  scroll: { padding: 16, gap: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  matchName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  matchMeta: { color: colors.textDim, marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  score: { color: colors.text, fontSize: 26, fontWeight: '800' },
  scoreSep: { color: colors.text, fontSize: 22, fontWeight: '700', marginHorizontal: 8 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  badgeTxt: { color: colors.text, fontWeight: '700', fontSize: 12 },
  winner: { color: colors.text, fontWeight: '700', marginTop: 10 },
  section: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontWeight: '800', marginBottom: 8 },
  playerRow: { paddingVertical: 8, borderTopWidth: 1, borderColor: colors.border },
  playerLeft: { gap: 2 },
  playerName: { color: colors.text, fontWeight: '700' },
  playerMeta: { color: colors.textDim, fontSize: 12 },
});
