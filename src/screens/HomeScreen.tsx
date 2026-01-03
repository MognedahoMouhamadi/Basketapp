// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { spacing, radius } from '../theme/tokens';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useUserProfile } from '../hooks/useUserProfile';
import { useOpenMatches } from '../hooks/useMatches';
import { useAuth } from '../hooks/useAuth';

type P = NativeStackScreenProps<AppStackParamList, 'Home'>;

// ...existing code...
export default function HomeScreen({ navigation }: P) {
  const { user: authUser } = useAuth();
  const { profile, loading, uid } = useUserProfile();

  const { data: openMatches, loading: loadingMatches } = useOpenMatches();

  const role = profile?.role ?? 'player';

  const goCreate = () => navigation.navigate('CreateGame');
  const goJoin   = () => navigation.navigate('JoinGame');
  const goStats  = () => navigation.navigate('PlayerStats' as any); // si tu as l’écran
  const doLogout = () => signOut(auth);

    const nameOf = (p: any) => {
    if (!p) return '—';
    if (typeof p === 'string') return p;
    return p.displayName || p.uid || '—';
  };

  // Move logic out of JSX
  const name = nameOf(profile) ?? nameOf(authUser) ?? 'Joueur';

  return (
    <SafeAreaView style={s.container} edges={['top','bottom']}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>BasketApp</Text>

          {/* use expression, not statements */}
          <Text style={s.subtitle}>
            {loading ? 'Chargement...' : `Bonjour ${name} !`}
          </Text>
        </View>

        {/* Badge Rôle + Logout */}
        <View style={s.headerRight}>
          <View style={[s.roleBadge, roleColors(role)]}>
            <Text style={s.roleTxt}>{role.toUpperCase()}</Text>
          </View>
          <Pressable onPress={doLogout} hitSlop={8} style={s.logout}>
            <Ionicons name="log-out-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <ActionButton
          icon="add-circle-outline"
          label="Créer une partie"
          onPress={goCreate}
          primary
        />
        <ActionButton
          icon="enter-outline"
          label="Rejoindre une partie"
          onPress={goJoin}
          outline
        />
      </View>

      {/* Bloc “Mes stats” (optionnel) */}
      <View style={{ marginTop: spacing.xl }}>
        <Card title="Mes stats" onPress={() => (authUser ? navigation.navigate('PlayerStats' as any) : navigation.navigate('AuthLanding' as any))} icon="stats-chart-outline"
          subtitle="Consultez vos performances" />
      </View>

      {/* Liste des parties ouvertes */}
      <View style={{ marginTop: spacing.xl, flex: 1 }}>
        <Text style={s.sectionTitle}>Parties ouvertes</Text>
        {loadingMatches ? (
          <View style={s.center}><ActivityIndicator/></View>
        ) : openMatches.length === 0 ? (
          <Text style={s.empty}>Aucune partie ouverte pour l’instant.</Text>
        ) : (
          <FlatList
            data={openMatches}
            keyExtractor={(m) => m.id}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => (
              <Pressable
                onPress={goJoin}
                style={s.matchItem}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.matchName}>{item.name}</Text>
                  <Text style={s.matchSub}>{item.place} · {item.format}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
              </Pressable>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
// ...existing code...

/* ---------- UI bits ---------- */

function ActionButton({
  icon, label, onPress, primary, outline,
}: { icon: any; label: string; onPress: () => void; primary?: boolean; outline?: boolean; }) {
  return (
    <Pressable
      style={[
        s.actionBtn,
        primary && { backgroundColor: colors.brand, borderColor: colors.brand },
        outline && { backgroundColor: 'transparent', borderColor: colors.brand },
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={18}
        color={primary ? '#0E0E0E' : colors.brand}
        style={{ marginRight: 8 }}
      />
      <Text style={[
        s.actionTxt,
        primary && { color: '#0E0E0E', fontWeight: '700' },
        outline && { color: colors.brand, fontWeight: '600' },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Card({ title, subtitle, icon, onPress }:{
  title: string; subtitle?: string; icon?: any; onPress?: () => void;
}) {
  const Content = (
    <View style={s.card}>
      <View style={s.cardIcon}>
        <Ionicons name={icon ?? 'albums-outline'} size={18} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{title}</Text>
        {subtitle ? <Text style={s.cardSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </View>
  );
  if (!onPress) return Content;
  return <Pressable onPress={onPress}>{Content}</Pressable>;
}

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textDim, marginTop: 4 },
  roleBadge: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  roleTxt: { fontSize: 11, fontWeight: '700', color: '#0E0E0E' },
  logout: {
    marginLeft: 8, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 6,
  },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: radius.xl, borderWidth: 1,
    backgroundColor: colors.card, borderColor: colors.border,
  },
  actionTxt: { color: colors.text, fontSize: 16 },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  empty: { color: colors.textDim },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
  cardIcon: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00000030',
  },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardSub: { color: colors.textDim, marginTop: 2 },

  matchItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg,
  },
  matchName: { color: colors.text, fontWeight: '700' },
  matchSub: { color: colors.textDim, marginTop: 2 },
  
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

});

/* Badge de rôle : couleur différente */
function roleColors(role: string) {
  if (role === 'admin')   return { backgroundColor: '#FFD54F', borderColor: '#FFC107' };
  if (role === 'referee') return { backgroundColor: '#80DEEA', borderColor: '#26C6DA' };
  return { backgroundColor: '#B2FF59', borderColor: '#76FF03' }; // player
}

