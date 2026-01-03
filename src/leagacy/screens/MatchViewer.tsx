// src/screens/MatchViewerScreen.tsx
import { View, Text, StyleSheet, FlatList, Pressable, Button, Alert, ActivityIndicator } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import colors from '../theme/colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppStackParamList } from '../navigation/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserProfile } from '../hooks/useUserProfile';
import { hasActiveMatch } from '../hooks/useActiveMatchGuard';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { joinTeamRemote } from '../services/functions';
import { isFinishedStatus } from '../services/matchStatus';

type P = NativeStackScreenProps<AppStackParamList, 'MatchViewer'>;

export default function MatchViewerScreen({ route, navigation }: P) {
  const { matchId } = (route.params ?? {}) as any;

  // UI d’origine
  const [name, setName] = useState<string>('Match');
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);

  // Ajouts: état match + pending
  const [match, setMatch] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const { uid, loading: loadingProfile } = useUserProfile();


//sert à obtenir le nom d'un joueur proprement
  // Helper to safely display player names
  const nameOf = (player: any) => {
    if (!player) return '—';
    if (typeof player === 'string') return player;
    return player.displayName || player.uid || '—';
  };

  // ---- Abonnement Firestore (réagit notamment à updatedAt) ----
  useEffect(() => {
    if (!matchId) return;
    const ref = doc(db, 'matches', String(matchId));
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (!data) {
        setLoading(false);
        return;
      }
      setMatch({ id: String(matchId), ...data });
      if (data.name) setName(data.name);
      if (typeof data.scoreA === 'number') setScoreA(data.scoreA);
      if (typeof data.scoreB === 'number') setScoreB(data.scoreB);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [matchId]);

  // ---- Dérivés (rôle & appartenance) ----
  const isReferee = useMemo(() => !!match && uid === match?.refereeId, [match, uid]);
  const playersA = useMemo<any[]>(() => {
    if (Array.isArray(match?.playersA)) return match?.playersA ?? [];
    if (Array.isArray(match?.players?.playersA)) return match?.players?.playersA ?? [];
    return [];
  }, [match?.playersA, match?.players]);
  const playersB = useMemo<any[]>(() => {
    if (Array.isArray(match?.playersB)) return match?.playersB ?? [];
    if (Array.isArray(match?.players?.playersB)) return match?.players?.playersB ?? [];
    return [];
  }, [match?.playersB, match?.players]);
  const isInA = useMemo(() => playersA.some((p: any) => p?.uid === uid), [playersA, uid]);
  const isInB = useMemo(() => playersB.some((p: any) => p?.uid === uid), [playersB, uid]);
  const isInAny = isInA || isInB;
  const isFinished = useMemo(() => isFinishedStatus(match?.status), [match?.status]);
  const teamLabel = useMemo(() => {
    if (isInA) return 'A';
    if (isInB) return 'B';
    return null;
  }, [isInA, isInB]);

  // ---- Action rejoindre équipe ----
  const handleTeamChange = async (team: 'A' | 'B' | null) => {
    if (!matchId || !uid) return;
    if (team && !isInAny && await hasActiveMatch(String(uid))) {
      Alert.alert('Déjà en match', 'Vous participez déjà à une autre partie.');
      return;
    }
    try {
      setPending(true);
      await joinTeamRemote(String(matchId), team);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Impossible de mettre à jour votre équipe');
    } finally {
      setPending(false);
    }
  };

  // ---- Rendu (identique, + bloc "join") ----
  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top','bottom']}>
        <View style={{padding:16}}><ActivityIndicator/></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      {/* Top bar */}
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.navigate('Home')} style={s.backBtn} accessibilityLabel="Retour à l'accueil">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Accueil</Text>
        </Pressable>
      </View>

      {/* Header: title + scores */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.title} numberOfLines={1}>{name}</Text>
        <View style={s.scoreCapsule}>
            <Text style={s.score}>{scoreA}</Text>
            <Text style={s.vs}>:</Text>
            <Text style={s.score}>{scoreB}</Text>
          </View>
        </View>
        <View style={s.headerBottom}>
          <Text style={s.timer}>00:00</Text>
          {isReferee ? <Text style={s.readonly}>Arbitre</Text> : <Text style={s.readonly}>Lecture seule</Text>}
        </View>
      </View>

      {/* === Nouveau : Contrôles rejoindre équipe (invisible pour l’arbitre) === */}
      {!!match && !!uid && !isFinished && match.refereeId !== uid && (
        <View style={{ gap: 8, marginBottom: 8 }}>
          {teamLabel && (
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              Tu es dans l’équipe {teamLabel}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Changer pour A" onPress={() => handleTeamChange('A')} disabled={pending || loadingProfile || isInA} />
            <Button title="Changer pour B" onPress={() => handleTeamChange('B')} disabled={pending || loadingProfile || isInB} />
          </View>
          <View style={{ marginTop: 8 }}>
            <Button title="Quitter" color="#c04848" onPress={() => handleTeamChange(null)} disabled={pending || !isInAny} />
          </View>
        </View>
      )}

      <Text style={s.section}>ÉQUIPE A</Text>
      <FlatList
        data={playersA}
        keyExtractor={(item: any, index) => item?.uid ?? index.toString()}
        renderItem={({ item }) => {
          const stats = item?.stats ?? {};
          return (
            <View style={s.row}>
              <Text style={s.name}>{nameOf(item)}</Text>
              <Text style={s.sub}>
                {(stats.pts ?? 0)} pts • {(stats.fouls ?? 0)} fautes • {(stats.blocks ?? 0)} blk
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={()=> <View style={{height:12}}/>}
      />

      <Text style={[s.section,{marginTop:16}]}>ÉQUIPE B</Text>
      <FlatList
        data={playersB}
        keyExtractor={(item: any, index) => item?.uid ?? index.toString()}
        renderItem={({ item }) => {
          const stats = item?.stats ?? {};
          return (
            <View style={s.row}>
              <Text style={s.name}>{nameOf(item)}</Text>
              <Text style={s.sub}>
                {(stats.pts ?? 0)} pts • {(stats.fouls ?? 0)} fautes • {(stats.blocks ?? 0)} blk
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={()=> <View style={{height:12}}/>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:colors.bg, padding:16 },
  topbar:{ paddingVertical: 4 },
  backBtn:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:6 },
  backTxt:{ color: colors.text, fontWeight:'700' },
  header:{
    backgroundColor:colors.card,
    borderRadius:16,
    padding:12,
    borderWidth:1,
    borderColor:colors.border,
    marginBottom:10,
  },
  headerTop:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    gap:12,
  },
  title:{ color:colors.text, fontWeight:'700', fontSize:16, flexShrink:1 },
  scoreCapsule:{
    flexDirection:'row',
    alignItems:'baseline',
    gap:8,
    paddingHorizontal:12,
    paddingVertical:4,
    borderRadius:999,
    backgroundColor:'rgba(255,255,255,0.06)',
    borderWidth:1,
    borderColor:colors.border,
  },
  score:{ color:colors.text, fontSize:22, fontWeight:'800' },
  vs:{ color:colors.textDim, fontSize:18, marginHorizontal:2 },
  headerBottom:{
    marginTop:8,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    gap:12,
  },
  timer:{ color:colors.text, fontSize:20 },
  readonly:{ color:colors.textDim },
  section:{ color:colors.brand, fontWeight:'700', marginVertical:8 },
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  name:{color:colors.text,fontWeight:'600'},
  sub:{color:colors.textDim,marginTop:2},
});
