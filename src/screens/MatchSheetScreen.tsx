// src/screens/MatchSheetScreen.tsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import PlayerRow from '../components/PlayerRow';
import { useMatch } from '../hooks/useMatches';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserProfile } from '../hooks/useUserProfile';
import { useMatchParticipants } from '../hooks/useMatchParticipants';
import { startMatchRemote, pushEventRemote, endMatchRemote } from '../services/functions';
import { startMatchLocal, pushEventLocal, endMatch as endMatchLocal } from '../services/matchService';
import { scoreDeltaFor, ScoreEventType } from '../services/matchScoring';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

type P = NativeStackScreenProps<AppStackParamList,'MatchSheet'>;

type IncomingPlayer = string | { uid?: string; displayName?: string; joinedAt?: number; stats?: any };

type NormalizedPlayer = {
  uid: string;
  displayName: string;
  joinedAt: number;
  stats?: { pts: number; fouls: number; blocks: number };
};

const normalizePlayer = (value: IncomingPlayer, fallback: string): NormalizedPlayer => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const uid = String(value.uid ?? value.displayName ?? fallback);
    const displayName = String(value.displayName ?? value.uid ?? fallback);
    const joinedAt = typeof value.joinedAt === 'number' ? value.joinedAt : Date.now();
    const stats = value.stats
      ? {
          pts: Math.max(0, Number(value.stats.pts ?? value.stats.points ?? 0)),
          fouls: Math.max(0, Number(value.stats.fouls ?? 0)),
          blocks: Math.max(0, Number(value.stats.blocks ?? 0)),
        }
      : undefined;
    return { uid, displayName, joinedAt, stats };
  }
  const safe = String(value ?? fallback);
  return { uid: safe, displayName: safe, joinedAt: Date.now() };
};

const isKnownFormat = (value: unknown): value is AppStackParamList['MatchRecap']['format'] => {
  return (
    typeof value === 'string' &&
    ['1v1', '2v2', '3v3', '4v4', '5v5'].includes(value)
  );
};

export default function MatchSheetScreen({ route, navigation }: P) {
  const {
    name='Match',
    playersA: incomingA = ['A1','A2','A3'],
    playersB: incomingB = ['B1','B2','B3'],
    place,
    format,
    matchId
  } = (route.params ?? {}) as any;

  const [match, setMatch] = useState<any | null>(null);
  const { playersA: participantsA, playersB: participantsB } = useMatchParticipants(matchId);
  const playersAList = useMemo(
    () => (participantsA.length ? participantsA : (Array.isArray(incomingA) ? incomingA : [])),
    [participantsA, incomingA]
  ) as IncomingPlayer[];
  const playersBList = useMemo(
    () => (participantsB.length ? participantsB : (Array.isArray(incomingB) ? incomingB : [])),
    [participantsB, incomingB]
  ) as IncomingPlayer[];

  const playersAData = useMemo(
    () => playersAList.map((p, idx) => normalizePlayer(p, `A${idx + 1}`)),
    [playersAList]
  );
  const playersBData = useMemo(
    () => playersBList.map((p, idx) => normalizePlayer(p, `B${idx + 1}`)),
    [playersBList]
  );

  const playerIdsA = useMemo(() => playersAData.map((p) => p.uid), [playersAData]);
  const playerIdsB = useMemo(() => playersBData.map((p) => p.uid), [playersBData]);

  const matchState = useMatch(playerIdsA, playerIdsB);
  const insets = useSafeAreaInsets();
  const { uid } = useUserProfile();

  useEffect(() => {
    if (!matchId) return;
    const ref = doc(db, 'matches', String(matchId));
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      if (data) setMatch({ id: snap.id, ...data });
    });
    return () => unsub();
  }, [matchId]);

  const canReferee = useMemo(() => {
    if (!uid) return false;
    if (match) {
      return match.refereeId === uid || match.createdBy === uid || match.creatorId === uid;
    }
    return route.params?.asReferee !== false;
  }, [uid, match, route.params?.asReferee]);

  const nameOf = (p: any) => {
    if (!p) return '—';
    if (typeof p === 'string') return p;
    return p.displayName || p.uid || '—';
  };

  const sendScoreEvent = async (team: 'A'|'B', playerId: string, type: ScoreEventType) => {
    if (!matchId || !canReferee) return;
    try {
      const points = scoreDeltaFor(type);
      if (Platform.OS === 'web') {
        await pushEventLocal({
          matchId: String(matchId),
          kind: type,
          uid: playerId,
          team,
          points,
        });
        return;
      }
      await pushEventRemote({
        matchId: String(matchId),
        kind: type,
        uid: playerId,
        team,
        points,
      });
    } catch (err: any) {
      try {
        await pushEventLocal({
          matchId: String(matchId),
          kind: type,
          uid: playerId,
          team,
          points: scoreDeltaFor(type),
        });
        return;
      } catch {}
      Alert.alert('Erreur', err?.message ?? 'Impossible d?enregistrer l?action.');
    }
  };

  const renderPlayer = (team:'A'|'B') => ({ item }: { item: NormalizedPlayer }) => (
    <PlayerRow
      name={nameOf(item)}
      stats={matchState.stats[item.uid]}
      disabled={!canReferee}
      onPlus2={()=> { if(canReferee) { matchState.push({ ts:Date.now(), team, playerId:item.uid, type:'PLUS2' }); sendScoreEvent(team, item.uid, 'PLUS2'); }}}
      onPlus3={()=> { if(canReferee) { matchState.push({ ts:Date.now(), team, playerId:item.uid, type:'PLUS3' }); sendScoreEvent(team, item.uid, 'PLUS3'); }}}
      onFoul ={()=> { if(canReferee) { matchState.push({ ts:Date.now(), team, playerId:item.uid, type:'FOUL'  }); sendScoreEvent(team, item.uid, 'FOUL'); }}}
      onBlock={()=> { if(canReferee) { matchState.push({ ts:Date.now(), team, playerId:item.uid, type:'BLOCK' }); sendScoreEvent(team, item.uid, 'BLOCK'); }}}
    />
  );

  const onStart = async () => {
    if (matchId && canReferee) {
      try {
        await startMatchLocal(String(matchId));
        if (Platform.OS !== 'web') {
          try { await startMatchRemote(String(matchId)); } catch (e: any) { console.warn('startMatchRemote failed', e?.code ?? e?.message ?? e); }
        }
      } catch (err: any) {
        console.warn('startMatchLocal failed', err?.code ?? err?.message ?? err);
        Alert.alert('Erreur', err?.code ? `${err.code}` : (err?.message ?? 'Impossible de d?marrer le match.'));
        return;
      }
    }
    matchState.start();
  };

  const handleEnd = async () => {
    if (matchId && canReferee) {
      const finalScore = { scoreA: scoreA ?? matchState.scoreA, scoreB: scoreB ?? matchState.scoreB };
      try {
        // Always persist locally; Cloud Function is optional.
        await endMatchLocal(String(matchId), finalScore);
        if (Platform.OS !== 'web') {
          try { await endMatchRemote(String(matchId)); } catch (e: any) { console.warn('endMatchRemote failed', e?.code ?? e?.message ?? e); }
        }
        Alert.alert('Match termin?', 'La partie est cl?tur?e avec succ?s.');
        navigation.navigate('Home');
      } catch (err: any) {
        console.warn('endMatchLocal failed', err?.code ?? err?.message ?? err);
        Alert.alert('Erreur', err?.code ? `${err.code}` : (err?.message ?? 'Impossible de terminer le match.'));
      }
      return;
    }

    navigation.navigate('MatchRecap', {
      stats: matchState.stats,
      name: nameOf(name),
      place: nameOf(place),
      format: isKnownFormat(format) ? format : undefined,
      playersA: playersAData.map((p) => p.uid),
      playersB: playersBData.map((p) => p.uid),
    });
  };
      try {
        // Always persist locally; Cloud Function is optional.
        await endMatchLocal(String(matchId), finalScore);
        if (Platform.OS !== 'web') {
          try { await endMatchRemote(String(matchId)); } catch {}
        }
        Alert.alert('Match termin?', 'La partie est cl?tur?e avec succ?s.');
        navigation.navigate('Home');
      } catch (err: any) {
        Alert.alert('Erreur', err?.message ?? 'Impossible de terminer le match.');
      }
      return;
    }

    navigation.navigate('MatchRecap', {
      stats: matchState.stats,
      name: nameOf(name),
      place: nameOf(place),
      format: isKnownFormat(format) ? format : undefined,
      playersA: playersAData.map((p) => p.uid),
      playersB: playersBData.map((p) => p.uid),
    });
  };

  const scoreA = match?.scoreA ?? matchState.scoreA;
  const scoreB = match?.scoreB ?? matchState.scoreB;

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.navigate('Home')} style={s.backBtn} accessibilityLabel="Retour à l'accueil">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Accueil</Text>
        </Pressable>
      </View>

      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.title} numberOfLines={1}>{match?.name ?? name}</Text>
          <View style={s.scoreCapsule}>
            <Text style={s.score}>{scoreA}</Text>
            <Text style={s.vs}>:</Text>
            <Text style={s.score}>{scoreB}</Text>
          </View>
        </View>

        <View style={s.headerBottom}>
          <Text style={s.timer}>{Math.floor(matchState.seconds/60)}:{String(matchState.seconds%60).padStart(2,'0')}</Text>
          {canReferee ? <Text style={s.readonly}>Arbitre</Text> : <Text style={s.readonly}>Lecture seule</Text>}
        </View>

        {canReferee && (
          <View style={s.actionsRow}>
            {!matchState.running ? (
              <Pressable style={[s.btnSmall,s.btnPrimary]} onPress={onStart}>
                <Text style={s.btnSmallTxt}>Start</Text>
              </Pressable>
            ) : (
              <Pressable style={[s.btnSmall,s.btnOutline]} onPress={matchState.pause}>
                <Text style={s.btnOutlineTxt}>Pause</Text>
              </Pressable>
            )}
            <Pressable style={[s.btnSmall,s.btnOutline]} onPress={matchState.restart}>
              <Text style={s.btnOutlineTxt}>Restart</Text>
            </Pressable>
            <Pressable style={[s.btnSmall,s.btnDanger]} onPress={handleEnd}>
              <Text style={s.btnSmallTxt}>End</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={s.section}>ÉQUIPE A</Text>
      <FlatList
        data={playersAData}
        keyExtractor={item=>item.uid}
        renderItem={renderPlayer('A')}
        contentContainerStyle={{ paddingBottom: (insets.bottom ?? 0) + 40 }}
      />

      <Text style={[s.section,{marginTop:16}]}>ÉQUIPE B</Text>
      <FlatList
        data={playersBData}
        keyExtractor={item=>item.uid}
        renderItem={renderPlayer('B')}
        contentContainerStyle={{ paddingBottom: (insets.bottom ?? 0) + 40 }}
      />

      {canReferee && (
        <View
          style={[
            s.footer,
            {
              paddingBottom: insets.bottom + 10,
              bottom: insets.bottom,
            },
          ]}
        >
          <Pressable style={[s.btnFoot, s.btnOutline]} onPress={matchState.undo}>
            <Text style={s.btnOutlineTxt}>Annuler</Text>
          </Pressable>
          <Pressable style={[s.btnFoot, s.btnOutline]} onPress={matchState.redo}>
            <Text style={s.btnOutlineTxt}>Refaire</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:colors.bg, padding:16 },
  topbar:{ paddingVertical:4 },
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
  score:{ color:colors.text, fontSize:22, fontWeight:'800', fontVariant:['tabular-nums'] as any },
  vs:{ color:colors.textDim, fontSize:18, marginHorizontal:2 },
  headerBottom:{
    marginTop:8,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    gap:12,
  },
  timer:{ color:colors.text, fontSize:20, fontVariant:['tabular-nums'] as any },
  actionsRow:{ flexDirection:'row', gap:8, marginTop:12 },
  btnSmall:{ paddingVertical:8, paddingHorizontal:12, borderRadius:10 },
  btnPrimary:{ backgroundColor:colors.brand }, btnSmallTxt:{ color:'#fff', fontWeight:'700' },
  btnOutline:{ borderWidth:1, borderColor:colors.border }, btnOutlineTxt:{ color:colors.text, fontWeight:'700' },
  btnDanger:{ backgroundColor:colors.red },
  section:{ color:colors.brand, fontWeight:'700', marginVertical:8 },
  readonly:{ color: colors.textDim },
  footer:{
    position:'absolute', left:16, right:16,
    flexDirection:'row', gap:12,
    backgroundColor:'rgba(0,0,0,0.04)',
    borderRadius:12,
    paddingHorizontal:12, paddingTop:12,
  },
  btnFoot:{ flex:1, alignItems:'center', justifyContent:'center', paddingVertical:12, borderRadius:12 },
});

