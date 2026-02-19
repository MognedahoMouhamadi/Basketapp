import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Switch, Alert, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../theme/colors';
import { spacing, radius } from '../theme/tokens';
import { CREATE_GAME_UI } from '../constants/ui';
import { CREATE_GAME_MIN_FIELD_LENGTH } from '../constants/domain';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { auth } from '../services/firebase';
import { Ionicons } from '@expo/vector-icons';
import { createMatch, MatchCategory, MatchVisibility } from '../services/matchService';

type P = NativeStackScreenProps<AppStackParamList, 'CreateGame'>;

type CreateGameFormState = {
  name: string;
  place: string;
  city: string;
  format: '3v3' | '4v4' | '5v5';
  category: MatchCategory;
  tournamentId: string;
  asReferee: boolean;
  isOpen: boolean;
  comment: string;
};

const FORMAT_OPTIONS = ['3v3', '4v4', '5v5'] as const;
const CATEGORY_OPTIONS = [
  { key: 'public' as const, label: 'Public' },
  { key: 'ranked' as const, label: 'ClassÃ©e' },
  { key: 'tournament' as const, label: 'Tournoi' },
];

const getInitialFormState = (): CreateGameFormState => ({
  name: 'Pickup Game',
  place: 'Terrain local',
  city: '',
  format: '3v3',
  category: 'public',
  tournamentId: '',
  asReferee: false,
  isOpen: true,
  comment: '',
});

const isFormSubmittable = (state: CreateGameFormState, busy: boolean): boolean =>
  state.name.trim().length >= CREATE_GAME_MIN_FIELD_LENGTH &&
  state.place.trim().length >= CREATE_GAME_MIN_FIELD_LENGTH &&
  state.city.trim().length >= CREATE_GAME_MIN_FIELD_LENGTH &&
  !busy;

const isTournamentSelectionMissing = (category: MatchCategory, tournamentId: string): boolean =>
  category === 'tournament' && !tournamentId.trim();

const getMatchVisibility = (category: MatchCategory, isOpen: boolean): MatchVisibility => {
  if (category === 'tournament') return 'tournament';
  if (isOpen) return 'public';
  return 'private';
};

const buildCreateMatchPayload = (state: CreateGameFormState, creatorId: string) => ({
  category: state.category,
  creatorId,
  tournamentId: state.category === 'tournament' ? state.tournamentId.trim() : undefined,
  name: state.name?.trim() ?? null,
  place: state.place?.trim() ?? null,
  city: state.city?.trim() ?? null,
  format: state.format ?? '3v3',
  description: state.comment.trim(),
  visibility: getMatchVisibility(state.category, state.isOpen),
});

const buildMatchSheetParams = (matchId: string, state: CreateGameFormState) => ({
  matchId,
  asReferee: state.category === 'ranked' ? true : state.asReferee,
  name: state.name.trim(),
  place: state.place.trim(),
  format: state.format,
  playersA: [],
  playersB: [],
});

const useCreateGameController = (navigation: P['navigation']) => {
  const [state, setState] = useState<CreateGameFormState>(getInitialFormState);
  const [busy, setBusy] = useState(false);
  const canSubmit = isFormSubmittable(state, busy);

  const onContinue = async () => {
    if (!canSubmit) return;

    const u = auth.currentUser;
    if (!u) {
      Alert.alert('Connexion requise', 'Connecte-toi pour crÃ©er une partie.');
      return;
    }

    try {
      setBusy(true);

      if (isTournamentSelectionMissing(state.category, state.tournamentId)) {
        Alert.alert('Tournoi requis', 'SÃ©lectionne un tournoi pour crÃ©er ce match.');
        return;
      }

      const id = await createMatch(buildCreateMatchPayload(state, u.uid));
      navigation.replace('MatchSheet', buildMatchSheetParams(id, state));
    } catch (e: any) {
      console.error('CreateGame error:', e?.code, e?.message, e);
      Alert.alert('Erreur', e?.message ?? 'Impossible de crÃ©er la partie.');
    } finally {
      setBusy(false);
    }
  };

  const updateState = <K extends keyof CreateGameFormState>(key: K, value: CreateGameFormState[K]) =>
    setState(prev => ({ ...prev, [key]: value }));

  return { state, busy, canSubmit, onContinue, updateState };
};

type LabeledInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  inputStyle?: StyleProp<TextStyle>;
};

function LabeledInput({ label, value, onChangeText, placeholder, multiline, inputStyle }: LabeledInputProps) {
  return (
    <>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        multiline={multiline}
      />
    </>
  );
}

type ToggleRowProps = {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
};

function ToggleRow({ label, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={s.optRow}>
      <Text style={s.optTxt}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? colors.brand : '#888'}
        trackColor={{ false: colors.border, true: colors.brand }}
      />
    </View>
  );
}

type FormViewProps = {
  controller: {
    state: CreateGameFormState;
    busy: boolean;
    canSubmit: boolean;
    onContinue: () => void;
    updateState: <K extends keyof CreateGameFormState>(key: K, value: CreateGameFormState[K]) => void;
  };
  onBack: () => void;
};

function CreateGameFormView({ controller, onBack }: FormViewProps) {
  const { state, busy, canSubmit, onContinue, updateState } = controller;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <Pressable onPress={onBack} style={s.back}>
        <Ionicons name="chevron-back" size={CREATE_GAME_UI.backIconSize} color={colors.text} />
        <Text style={s.backTxt}>Retour</Text>
      </Pressable>

      <Text style={s.h}>CrÃ©er une partie</Text>

      <LabeledInput
        label="Nom"
        value={state.name}
        onChangeText={value => updateState('name', value)}
        placeholder="Nom de la partie"
      />
      <LabeledInput
        label="Lieu"
        value={state.place}
        onChangeText={value => updateState('place', value)}
        placeholder="Lieu"
      />
      <LabeledInput
        label="Ville"
        value={state.city}
        onChangeText={value => updateState('city', value)}
        placeholder="Ville"
      />

      <Text style={s.label}>Format</Text>
      <View style={s.row}>
        {FORMAT_OPTIONS.map(f => (
          <Pressable key={f} onPress={() => updateState('format', f)} style={[s.chip, state.format === f && s.chipSel]}>
            <Text style={[s.chipTxt, state.format === f && s.chipTxtSel]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>CatÃ©gorie</Text>
      <View style={s.row}>
        {CATEGORY_OPTIONS.map(opt => (
          <Pressable
            key={opt.key}
            onPress={() => updateState('category', opt.key)}
            style={[s.chip, state.category === opt.key && s.chipSel]}
          >
            <Text style={[s.chipTxt, state.category === opt.key && s.chipTxtSel]}>{opt.label}</Text>
          </Pressable>
        ))}
      </View>

      {state.category === 'tournament' && (
        <LabeledInput
          label="ID du tournoi"
          value={state.tournamentId}
          onChangeText={value => updateState('tournamentId', value)}
          placeholder="tournamentId"
        />
      )}

      {state.category !== 'ranked' && (
        <ToggleRow
          label="Je suis arbitre"
          value={state.asReferee}
          onValueChange={next => updateState('asReferee', next)}
        />
      )}

      <ToggleRow
        label="Partie listable"
        value={state.isOpen}
        onValueChange={next => updateState('isOpen', next)}
      />

      <LabeledInput
        label="Commentaire (optionnel)"
        value={state.comment}
        onChangeText={value => updateState('comment', value)}
        placeholder="Annonce, rÃ¨gle spÃ©ciale, etc."
        multiline
        inputStyle={{ height: CREATE_GAME_UI.commentInputHeight, textAlignVertical: 'top' }}
      />

      <Pressable style={[s.btn, !canSubmit && { opacity: CREATE_GAME_UI.disabledOpacity }]} onPress={onContinue} disabled={!canSubmit}>
        <Text style={s.btnTxt}>{busy ? '...' : 'Continuer'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export default function CreateGameScreenUTF8({ navigation }: P) {
  const controller = useCreateGameController(navigation);

  return (
    <CreateGameFormView
      controller={controller}
      onBack={() => navigation.goBack()}
    />
  );
}

const s = StyleSheet.create({
  container:{ flex:1, backgroundColor:colors.bg, padding:spacing.xxl },
  back:{ flexDirection:'row', alignItems:'center', gap:CREATE_GAME_UI.backRowGap, marginBottom:spacing.md },
  backTxt:{ color: colors.text, fontSize:CREATE_GAME_UI.backTextSize },
  h:{ color:colors.text, fontSize:CREATE_GAME_UI.titleTextSize, fontWeight:'700', marginBottom:spacing.lg },
  label:{ color:colors.textDim, marginTop:spacing.md },
  input:{ backgroundColor:colors.card, color:colors.text, borderRadius:radius.xl, padding:CREATE_GAME_UI.inputPadding, marginTop:CREATE_GAME_UI.inputMarginTop, borderWidth:CREATE_GAME_UI.inputBorderWidth, borderColor:colors.border },
  row:{ flexDirection:'row', gap:CREATE_GAME_UI.rowGap, marginTop:CREATE_GAME_UI.rowMarginTop },
  chip:{ borderWidth:CREATE_GAME_UI.inputBorderWidth, borderColor:colors.border, borderRadius:CREATE_GAME_UI.chipRadius, paddingVertical:CREATE_GAME_UI.chipVerticalPadding, paddingHorizontal:CREATE_GAME_UI.chipHorizontalPadding },
  chipSel:{ borderColor:colors.brand, backgroundColor:'#0000' },
  chipTxt:{ color:colors.textDim },
  chipTxtSel:{ color:colors.brand, fontWeight:'600' },
  optRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:spacing.lg },
  optTxt:{ color:colors.text },
  btn:{ backgroundColor:colors.brand, marginTop:spacing.xl, paddingVertical:CREATE_GAME_UI.submitButtonVerticalPadding, borderRadius:radius.xl, alignItems:'center' },
  btnTxt:{ color:'#fff', fontWeight:'700' },
});
