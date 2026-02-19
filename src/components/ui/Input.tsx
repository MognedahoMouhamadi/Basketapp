// src/components/ui/Input.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
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
  const toggleIconName = hidden ? 'eye-outline' : 'eye-off-outline';
  const showVisibilityToggle = !!secureTextEntry;

  const renderVisibilityToggle = () => {
    if (!showVisibilityToggle) return null;

    return (
      <Pressable onPress={() => setHidden(v => !v)} hitSlop={10}>
        <Ionicons
          name={toggleIconName}
          size={20}
          color={colors.textDim}
        />
      </Pressable>
    );
  };

  return (
    <View style={s.container}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.inputWrapper}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDim}
          style={s.input}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
        {renderVisibilityToggle()}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { color: colors.text, opacity: 0.9 },
  inputWrapper: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: { color: colors.text, flex: 1 },
});
