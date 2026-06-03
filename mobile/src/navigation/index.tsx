import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../constants/theme';
import {
  IcHome, IcExplore, IcCreate, IcThreads,
  IcProfile, IcBrand,
} from '../components/ui/Icons';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main screens
import FeedScreen from '../screens/feed/FeedScreen';
import ExploreScreen from '../screens/explore/ExploreScreen';
import CreateScreen from '../screens/upload/UploadScreen';
import ThreadsScreen from '../screens/threads/ThreadsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Detail screens
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string; username: string };
  Conversation: { conversationId: string; otherUser: { id: string; display_name: string } };
  Messages: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Create: undefined;
  Threads: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_LABELS: Record<string, string> = {
  Home: 'Accueil', Explore: 'Explorer', Create: '', Threads: 'Fils', Profile: 'Profil',
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? COLORS.tabActive : COLORS.tabInactive;
  const size = 22;
  switch (name) {
    case 'Home':    return <IcHome    size={size} color={color} />;
    case 'Explore': return <IcExplore size={size} color={color} />;
    case 'Threads': return <IcThreads size={size} color={color} />;
    case 'Profile': return <IcProfile size={size} color={color} />;
    default:        return null;
  }
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }, SHADOW.md]}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const isCreate = route.name === 'Create';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (isCreate) {
          return (
            <TouchableOpacity key={route.key} style={styles.createBtn} onPress={onPress} activeOpacity={0.85}>
              <View style={styles.createInner}>
                <IcCreate size={22} color={COLORS.white} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <TabIcon name={route.name} focused={isFocused} />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {TAB_LABELS[route.name]}
            </Text>
            {isFocused && <View style={styles.tabDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Threads" component={ThreadsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingLogo}>
          <IcBrand size={32} color={COLORS.primary} />
        </View>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen
              name="PostDetail"
              component={PostDetailScreen}
              options={{ animation: 'slide_from_bottom', headerShown: false }}
            />
            <RootStack.Screen name="UserProfile" component={UserProfileScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen
              name="Conversation"
              component={ConversationScreen}
              options={{ headerShown: true, headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.primary, headerTitle: '', headerShadowVisible: false }}
            />
            <RootStack.Screen name="Messages" component={MessagesScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Settings" component={SettingsScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center',
  },
  loadingLogo: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.primaryLight,
  },
  loadingEmoji: { fontSize: 32, fontWeight: '700', color: COLORS.primary },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    paddingHorizontal: SPACING.sm,
  },
  tabItem: {
    flex: 1, alignItems: 'center', gap: 3, position: 'relative',
  },
  tabIcon: { fontSize: 20, color: COLORS.tabInactive },
  tabIconActive: { color: COLORS.tabActive },
  tabLabel: { fontSize: 10, fontWeight: FONT.weight.medium, color: COLORS.tabInactive },
  tabLabelActive: { color: COLORS.tabActive, fontWeight: FONT.weight.semibold },
  tabDot: {
    position: 'absolute', bottom: -6, width: 4, height: 4,
    borderRadius: 2, backgroundColor: COLORS.primary,
  },
  createBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  createInner: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -12,
    ...SHADOW.green,
  },
  createIcon: { fontSize: 24, color: COLORS.white, fontWeight: FONT.weight.bold, marginTop: -2 },
});
