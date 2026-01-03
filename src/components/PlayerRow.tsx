import { View, Text, Pressable, StyleSheet } from 'react-native';
import colors from '../theme/colors';

type Props = {
  name: string;
  stats?: { points?: number; fouls?: number; blocks?: number };
  disabled?: boolean;
  onPlus2: ()=>void;
  onPlus3: ()=>void;
  onFoul: ()=>void;
  onBlock: ()=>void;
};

export default function PlayerRow({ name, stats, disabled, onPlus2, onPlus3, onFoul, onBlock }: Props) {
  return (
    <View style={s.row}>
      <View style={{flex:1}}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.sub}>
          {(stats?.points ?? 0)} pts · {(stats?.fouls ?? 0)} fautes · {(stats?.blocks ?? 0)} blk
        </Text>
      </View>
      <Pressable disabled={!!disabled} onPress={onPlus2} style={[s.btn,{backgroundColor:colors.red, opacity: disabled?0.5:1}]}><Text style={s.btnText}>+2</Text></Pressable>
      <View style={{width:8}}/>
      <Pressable disabled={!!disabled} onPress={onPlus3} style={[s.btn,{backgroundColor:colors.green, opacity: disabled?0.5:1}]}><Text style={s.btnText}>+3</Text></Pressable>
      <View style={{width:8}}/>
      <Pressable disabled={!!disabled} onPress={onFoul} style={[s.btn,{backgroundColor:colors.textDim, opacity: disabled?0.5:1}]}><Text style={s.btnText}>Faute</Text></Pressable>
      <View style={{width:8}}/>
      <Pressable disabled={!!disabled} onPress={onBlock} style={[s.btn,{backgroundColor:colors.blue, opacity: disabled?0.5:1}]}><Text style={s.btnText}>Bloc</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
  name:{color:colors.text,fontWeight:'600'},
  sub:{color:colors.textDim,marginTop:2},
  btn:{paddingVertical:10,paddingHorizontal:12,borderRadius:12,minWidth:56,alignItems:'center',justifyContent:'center'},
  btnText:{color:'#fff',fontWeight:'600'}
});
