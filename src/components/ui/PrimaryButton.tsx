// src/components/ui/PrimaryButton.tsx
import React from 'react';
import { Pressable, Text } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

type Props = { title: string; onPress: () => void; disabled?: boolean; };
export default function PrimaryButton({ title, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? colors.primaryDim : colors.primary,
        paddingVertical: spacing.lg,
        alignItems:'center',
        borderRadius: radius.xl,
        opacity: disabled ? 0.7 : 1
      }}
    >
      <Text style={{ color: '#0E0E0E', fontWeight:'700' }}>{title}</Text>
    </Pressable>
  );
}
