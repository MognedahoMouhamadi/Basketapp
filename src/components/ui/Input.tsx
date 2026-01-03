// src/components/ui/Input.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export default function Input({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType='default', autoCapitalize='none'
}: Props) {
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={{ color: colors.text, opacity:0.9 }}>{label}</Text> : null}
      <View style={{
        backgroundColor: colors.bg,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        flexDirection:'row', alignItems:'center', gap: spacing.sm
      }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          style={{ color: colors.text, flex: 1 }}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden(v => !v)} hitSlop={10}>
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textDim}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
