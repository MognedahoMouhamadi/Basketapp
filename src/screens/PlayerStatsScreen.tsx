import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import colors from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import { usePlayerStats } from '../hooks/usePlayerStats';

type EloPoint = { t?: string; ts?: number; elo: number };

export default function PlayerStatsScreen() {
  const navigation = useNavigation<any>();
  const { user: authUser } = useAuth();
  const { profile, uid } = useUserProfile();

  const { player: ps, history, loading } = usePlayerStats(authUser?.uid ?? '');

  const name = profile?.displayName ?? authUser?.displayName ?? 
  authUser?.email?.split('@')[0] ?? '—';

  const initials = useMemo(() => name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase(), [name]);

  const player = {
    initials,
    name,
    team: ps?.team ?? '-',
    age: ps?.age ?? undefined,
    position: ps?.position ?? '-',
    winRate: typeof ps?.winRate === 'number' ? ps.winRate : 0,
    kda: typeof ps?.kda === 'number' ? ps.kda : 0,
    rankStr: ps?.rankStr ?? '#—',
    elo: typeof ps?.elo === 'number' ? ps.elo : 0,
    eloDelta: typeof ps?.eloDelta === 'number' ? ps.eloDelta : 0,
    avgScore: typeof ps?.avgScore === 'number' ? ps.avgScore : 0,
    avgScoreDelta: typeof ps?.avgScoreDelta === 'number' ? ps.avgScoreDelta : 0,
    winRatioDelta: typeof ps?.winRatioDelta === 'number' ? ps.winRatioDelta : 0,
    matches: typeof ps?.matches === 'number' ? ps.matches : 0,
    matchesDelta: typeof ps?.matchesDelta === 'number' ? ps.matchesDelta : 0,
    bestStreak: typeof ps?.bestStreak === 'number' ? ps.bestStreak : 0,
    totalPoints: typeof ps?.totalPoints === 'number' ? ps.totalPoints : 0,
    totalPointsDelta: typeof ps?.totalPointsDelta === 'number' ? ps.totalPointsDelta : 0,
  };

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      <View style={s.topbar}>
        <Pressable style={s.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Retour">
          <ArrowLeft size={20} color={colors.text} />
          <Text style={s.backTxt}>Retour</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{player.initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{player.name}</Text>
            <View style={s.tagsRow}>
              <Tag>{`ELO ${player.elo}`}</Tag>
              {player.team ? (<><Dot /><Text style={s.tagTxt}>{player.team}</Text></>) : null}
              {typeof player.age === 'number' ? (<><Dot /><Text style={s.tagTxt}>{player.age} ans</Text></>) : null}
              {player.position ? (<><Dot /><Text style={s.tagTxt}>{player.position}</Text></>) : null}
            </View>
          </View>
        </View>

        {/* KPIs ligne 1 */}
        <View style={s.kpiRow}>
          <Kpi label="Win Rate" value={`${Math.round(player.winRate*100)}%`} color="#2ecc71" />
          <Kpi label="KDA" value={`${player.kda}`} />
          <Kpi label="Position" value={player.rankStr} />
        </View>

        {/* Stats clés (grille) */}
        <Text style={s.sectionTitle}>STATISTIQUES CLÉS</Text>
        <View style={s.grid}>
          <StatCard
            title="ELO RATING"
            value={`${player.elo}`}
            delta={player.eloDelta}
            meterColor={colors.brand}
          />
          <StatCard
            title="AVG SCORE"
            value={`${player.avgScore}`}
            fractionDigits={1}
            delta={player.avgScoreDelta}
            meterColor="#2d7ff9"
          />
          <StatCard
            title="WIN RATIO"
            value={`${Math.round(player.winRate*100)}%`}
            delta={Math.round(player.winRatioDelta*100)}
            meterColor="#2ecc71"
          />
          <StatCard
            title="MATCHES"
            value={`${player.matches}`}
            delta={player.matchesDelta}
            meterColor={colors.border}
          />
          <StatCard
            title="BEST STREAK"
            value={`${player.bestStreak}`}
            meterColor={colors.brand}
          />
          <StatCard
            title="TOTAL POINTS"
            value={`${player.totalPoints.toLocaleString('fr-FR')}`}
            delta={player.totalPointsDelta}
            meterColor="#2d7ff9"
          />
        </View>

        {/* Graph ELO */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Évolution de l’ELO</Text>
          {loading ? (
            <View style={{ paddingVertical: 40, alignItems:'center' }}><ActivityIndicator color={colors.brand}/></View>
          ) : (
            <EloLineChart data={history as unknown as EloPoint[]} height={160} />
          )}
          <View style={s.xLabels}>
            {(history as EloPoint[]).map((p, i) => (
              <Text key={i} style={s.xLabel}>{i%2===0 ? p.t : ''}</Text>
            ))}
          </View>
        </View>

        <Pressable style={s.cta} onPress={() => navigation.navigate('MatchHistory', { mode: 'user' })}>
          <Text style={s.ctaTxt}>Voir l’historique des matchs</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- UI Atoms / Molecules ---------- */

function Tag({ children }: { children: React.ReactNode }) {
  return <View style={s.tag}><Text style={s.tagStrong}>{children}</Text></View>;
}
function Dot() { return <View style={s.dot} />; }

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function StatCard({
  title, value, delta, meterColor, fractionDigits,
}: { title: string; value: string; delta?: number; meterColor?: string; fractionDigits?: number }) {
  const good = (delta ?? 0) >= 0;
  return (
    <View style={s.statCard}>
      <Text style={s.statTitle}>{title}</Text>
      <Text style={s.statValue}>{value}</Text>
      {typeof delta === 'number' && (
        <Text style={[s.delta, { color: good ? '#2ecc71' : '#e74c3c' }]}>
          {good ? '↗' : '↘'} {Math.abs(delta).toFixed(fractionDigits ?? 0)}
        </Text>
      )}
      <View style={s.meter}>
        <View style={[s.meterFill, { backgroundColor: meterColor ?? colors.brand, width: '60%' }]} />
      </View>
    </View>
  );
}

function EloLineChart({ data, height=160 }: { data: EloPoint[]; height?: number }) {
  const { path, min, max } = useMemo(() => {
    const values = data.map(d => d.elo);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.2 || 20;
    const ymin = min - pad, ymax = max + pad;

    const w = 320; // largeur SVG (suffisant mobile; le container centre)
    const h = height;
    const stepX = w / Math.max(1, data.length - 1);
    const y = (v: number) => h - ((v - ymin) / (ymax - ymin)) * h;

    let d = '';
    data.forEach((p, i) => {
      const X = i * stepX;
      const Y = y(p.elo);
      d += i === 0 ? `M ${X} ${Y}` : ` L ${X} ${Y}`;
    });
    return { path: d, min, max };
  }, [data, height]);

  const w = 320;
  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.brand} stopOpacity="0.8" />
            <Stop offset="1" stopColor={colors.brand} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Path d={path} stroke="url(#grad)" strokeWidth={3} fill="none" />
        {/* Point final */}
        <Circle cx={w} cy={height/2} r={0} fill="transparent" />
      </Svg>
      <View style={s.minmax}>
        <Text style={s.minmaxTxt}>min {min}</Text>
        <Text style={s.minmaxTxt}>max {max}</Text>
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor: colors.bg },
  header:{ flexDirection:'row', gap:12, alignItems:'center', marginBottom:12 },
  avatar:{ width:56, height:56, borderRadius:28, backgroundColor: colors.card, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:colors.border },
  avatarTxt:{ color: colors.text, fontWeight:'700' },
  name:{ color: colors.text, fontSize:20, fontWeight:'800' },
  tagsRow:{ flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:8, marginTop:6 },
  tag:{ backgroundColor:'#151a22', borderWidth:1, borderColor:colors.border, paddingHorizontal:8, paddingVertical:4, borderRadius:8 },
  tagStrong:{ color: colors.text, fontWeight:'700' },
  tagTxt:{ color: colors.textDim },
  dot:{ width:4, height:4, borderRadius:2, backgroundColor: colors.border },
  kpiRow:{ flexDirection:'row', gap:12, marginBottom:12 },
  kpi:{ flex:1, backgroundColor: colors.card, borderRadius:14, borderWidth:1, borderColor:colors.border, padding:12 },
  kpiLabel:{ color: colors.textDim, marginBottom:6 },
  kpiValue:{ color: colors.text, fontWeight:'800', fontSize:18 },
  sectionTitle:{ color: colors.text, fontWeight:'800', marginTop:6, marginBottom:10 },
  grid:{ flexDirection:'row', flexWrap:'wrap', gap:12 },
  statCard:{ width:'48%', backgroundColor: colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:14 },
  statTitle:{ color: colors.textDim, marginBottom:8 },
  statValue:{ color: colors.text, fontWeight:'800', fontSize:22 },
  delta:{ marginTop:6, fontWeight:'700' },
  meter:{ height:6, borderRadius:4, backgroundColor:'#202734', marginTop:10, overflow:'hidden' },
  meterFill:{ height:'100%', width:'40%', borderRadius:4 },
  card:{ backgroundColor: colors.card, borderRadius:16, borderWidth:1, borderColor:colors.border, padding:14, marginTop:12 },
  cardTitle:{ color: colors.text, fontWeight:'800', marginBottom:8 },
  xLabels:{ flexDirection:'row', justifyContent:'space-between', marginTop:6 },
  xLabel:{ color: colors.textDim, fontSize:12 },
  minmax:{ width:320, flexDirection:'row', justifyContent:'space-between', marginTop:6 },
  minmaxTxt:{ color: colors.textDim, fontSize:12 },
  cta:{ marginTop:14, backgroundColor: colors.brand, borderRadius:12, alignItems:'center', paddingVertical:14 },
  ctaTxt:{ color:'#fff', fontWeight:'800' },
  topbar:{ paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderColor: colors.border },
  backBtn:{ flexDirection:'row', alignItems:'center', gap:8 },
  backTxt:{ color: colors.text, fontWeight:'700' },
});

