// src/screens/MatchViewerScreen.tsx
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import colors from '../theme/colors';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { AppStackParamList } from '../navigation/types';

import { SafeAreaView } from 'react-native-safe-area-context';

type P = NativeStackScreenProps<AppStackParamList, 'MatchViewer'>;

export default function MatchViewerScreen({ route, navigation }: P) {
  const { name: nameParam = 'Match', matchId, playersA = [], playersB = [] } = route.params ?? {} as any;
  const [name, setName] = useState<string>(nameParam);
  const [scoreA, setScoreA] = useState<number>(0);
  const [scoreB, setScoreB] = useState<number>(0);

  const nameOf = (player: any) => {
  if (!player) return '—';
  if (typeof player === 'string') return player; // fallback
  return player.displayName ?? player.uid ?? '—';
};


  useEffect(() => {
    if (!route.params?.matchId) return;
    const matchId = route.params.matchId as string;

    let unsub: any = null;
    (async () => {
      // 1) Try @react-native-firebase/firestore
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const rnfb = await (Function('return import("@react-native-firebase/firestore")')() as Promise<any>);
        const firestore = rnfb?.default?.();
        if (firestore) {
          unsub = firestore
            .collection('matches')
            .doc(matchId)
            .onSnapshot((snap: any) => {
              const data = typeof snap.data === 'function' ? snap.data() : snap.data;
              if (!data) return;
              if (data.name) setName(data.name);
              if (typeof data.scoreA === 'number') setScoreA(data.scoreA);
              if (typeof data.scoreB === 'number') setScoreB(data.scoreB);
            });
          return; // RNFB branch ok
        }
      } catch {}

      // 2) Else: Firebase Web v9
      try {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const mod = await import('firebase/firestore');
        const { getFirestore, doc, onSnapshot } = mod ?? {};
        const db = getFirestore();
        unsub = onSnapshot(doc(db, 'matches', matchId), (snap: any) => {
          const data = snap.data();
          if (!data) return;
          if (data.name) setName(data.name);
          if (typeof data.scoreA === 'number') setScoreA(data.scoreA);
          if (typeof data.scoreB === 'number') setScoreB(data.scoreB);
        });
      } catch {}
    })();

    return () => { if (typeof unsub === 'function') unsub(); };
  }, [route.params?.matchId]);

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      {/* Top bar */}
      <View style={s.topbar}>
        <Pressable onPress={() => navigation.navigate('Home')} style={s.backBtn} accessibilityLabel="Retour à l'accueil">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.backTxt}>Accueil</Text>
        </Pressable>
      </View>
      {/* Header: title + scores placeholder (read-only) */}
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
          <Text style={s.readonly}>Lecture seule</Text>
        </View>
      </View>

      <Text style={s.section}>ÉQUIPE A</Text>
      <FlatList
        data={Array.isArray(playersA) ? playersA : []}
        keyExtractor={(item: any, idx) => String(item?.uid ?? idx)}
        renderItem={({ item }) => (
        <View style={s.row}>
          <Text style={s.name}>{nameOf(item)}</Text>
          <Text style={s.sub}>0 pts • 0 fautes • 0 blk</Text>
        </View>
      )}
      ItemSeparatorComponent={()=> <View style={{height:12}}/>}
      />

      <Text style={[s.section,{marginTop:16}]}>ÉQUIPE B</Text>
      <FlatList
        data={Array.isArray(playersB) ? playersB : []}
        keyExtractor={(item: any, idx) => String(item?.uid ?? idx)}
        renderItem={({ item }) => (
        <View style={s.row}>
          <Text style={s.name}>{nameOf(item)}</Text>
          <Text style={s.sub}>0 pts • 0 fautes • 0 blk</Text>
        </View>
      )}
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

