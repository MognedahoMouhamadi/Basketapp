import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import type { AppStackParamList, AuthStackParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import CreateGameScreen from '../screens/CreateGameScreenUTF8';
import JoinGameScreen from '../screens/JoinGameScreen';
import MatchSheetScreen from '../screens/MatchSheetScreen';
import MatchViewerScreen from '../screens/MatchViewerScreenUTF8';
import MatchRecapScreen from '../screens/MatchRecapScreen';
import PlayerStatsScreen from '../screens/PlayerStatsScreen';
import MatchHistoryScreen from '../screens/MatchHistoryScreen';

import AuthLandingScreen from '../screens/AuthLandingScreen';
import EmailAuthScreen from '../screens/EmailAuthScreen';

const AppStack = createNativeStackNavigator<AppStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Home" component={HomeScreen} />
      <AppStack.Screen name="CreateGame" component={CreateGameScreen} />
      <AppStack.Screen name="JoinGame" component={JoinGameScreen} />
      <AppStack.Screen name="MatchSheet" component={MatchSheetScreen} />
      <AppStack.Screen name="MatchViewer" component={MatchViewerScreen} />
      <AppStack.Screen name="MatchRecap" component={MatchRecapScreen} />
      <AppStack.Screen name="PlayerStats" component={PlayerStatsScreen} />
      <AppStack.Screen name="MatchHistory" component={MatchHistoryScreen} />
    </AppStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="AuthLanding" component={AuthLandingScreen} />
      <AuthStack.Screen name="EmailAuth" component={EmailAuthScreen} />
    </AuthStack.Navigator>
  );
}

export default function RootNavigation() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
