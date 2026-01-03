import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type Props = {
  home: number;
  away: number;
  onScoreHome?: (points: number) => void;
  onScoreAway?: (points: number) => void;
};

export default function ScoreBar({ home, away, onScoreHome, onScoreAway }: Props) {
  return (
    <View style={styles.container}>
      <TeamScore
        label="Home"
        score={home}
        onTwo={() => onScoreHome?.(2)}
        onThree={() => onScoreHome?.(3)}
      />
      <Text style={styles.separator}>-</Text>
      <TeamScore
        label="Away"
        score={away}
        onTwo={() => onScoreAway?.(2)}
        onThree={() => onScoreAway?.(3)}
      />
    </View>
  );
}

function TeamScore({
  label,
  score,
  onTwo,
  onThree,
}: {
  label: string;
  score: number;
  onTwo?: () => void;
  onThree?: () => void;
}) {
  return (
    <View style={styles.team}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.score}>{score}</Text>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btn} onPress={onTwo}><Text style={styles.btnText}>+2</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onThree}><Text style={styles.btnText}>+3</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 8,
  },
  separator: { fontSize: 18, fontWeight: '600' },
  team: { alignItems: 'center' },
  label: { fontSize: 12, color: '#6B7280' },
  score: { fontSize: 28, fontWeight: '800' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btn: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: 'white', fontWeight: '700' },
});

