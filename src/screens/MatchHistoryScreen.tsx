import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { useUserProfile } from '../hooks/useUserProfile';
import { useMatchHistory, useUserMatchHistory } from '../hooks/useMatchHistory';

type P = NativeStackScreenProps<AppStackParamList, 'MatchHistory'>;

export default function MatchHistoryScreen({ route, navigation }: P) {
  const mode = route.params?.mode ?? 'user';
  const { uid } = useUserProfile();
  const user = useUserMatchHistory(uid ?? undefined);
  const global = useMatchHistory();
  const data = mode === 'global' ? global.data : user.data;
  const loading = mode === 'global' ? global.loading : user.loading;
  const error = mode === 'global' ? global.error : user.error;

  const title = mode === 'global' ? 'Historique global' : 'Mes matchs';

  const rows = useMemo(() => data, [data]);

  const formatDate = (val: any) => {
    const ts = val?.toMillis?.() ?? val ?? null;
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleDateString('fr-FR');
  };

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
        <Text style={s.title}>{title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.brand} /></View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorTxt}>Erreur: {error.message ?? 'Impossible de charger l’historique.'}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTxt}>Aucun match terminé pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle}>{item.name ?? 'Match'}</Text>
                <Text style={s.cardStatus}>{String(item.status ?? 'finished')}</Text>
              </View>
              <Text style={s.cardSub}>{item.place ?? '-'}</Text>
              <View style={s.metaRow}>
                <Text style={s.cardMeta}>
                  {item.scoreA ?? 0} : {item.scoreB ?? 0}
                </Text>
                <Text style={s.cardMeta}>{formatDate(item.endedAt ?? item.updatedAt)}</Text>
              </View>
            </View>
          )}
        />
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
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardStatus: { color: colors.textDim, fontSize: 12 },
  cardSub: { color: colors.textDim, marginTop: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardMeta: { color: colors.text, fontWeight: '700' },
});
