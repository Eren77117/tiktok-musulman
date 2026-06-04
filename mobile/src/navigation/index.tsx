import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Modal, Pressable,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../constants/theme';
import {
  IcHome, IcExplore, IcCreate, IcMail,
  IcProfile, IcBrand,
} from '../components/ui/Icons';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main tabs
import FeedScreen from '../screens/feed/FeedScreen';
import ExploreScreen from '../screens/explore/ExploreScreen';
import CreateScreen from '../screens/upload/UploadScreen';
import MessagesScreen from '../screens/messages/MessagesScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Stack screens
import PostDetailScreen from '../screens/feed/PostDetailScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import ConversationScreen from '../screens/messages/ConversationScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ThreadComposerScreen from '../screens/threads/ThreadComposerScreen';
import SoundScreen from '../screens/sound/SoundScreen';
import VideoPlayerScreen from '../screens/feed/VideoPlayerScreen';
import ThreadDetailScreen from '../screens/threads/ThreadDetailScreen';
import GoLiveScreen from '../screens/live/GoLiveScreen';
import LiveViewerScreen from '../screens/live/LiveViewerScreen';
import LiveListScreen from '../screens/live/LiveListScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  PostDetail: { postId: string };
  UserProfile: { userId: string; username: string };
  Conversation: { conversationId: string; otherUser: { id: string; display_name: string } };
  Messages: undefined;
  Notifications: undefined;
  Settings: undefined;
  ThreadComposer: undefined;
  Sound: { soundId: string; title: string; artist?: string | null };
  VideoPlayer: { postId: string };
  ThreadDetail: { threadId: string };
  GoLive: undefined;
  LiveViewer: { sessionId: string; broadcasterId: string };
  LiveList: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type TabParamList = {
  Home: undefined;
  Explore: undefined;
  Create: undefined;
  Messages: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_LABELS: Record<string, string> = {
  Home: 'Accueil', Explore: 'Explorer', Create: '', Messages: 'Boite', Profile: 'Profil',
};

function TabIcon({ name, focused, theme }: { name: string; focused: boolean; theme: any }) {
  const color = focused ? theme.tabActive : theme.tabInactive;
  const size = 22;
  switch (name) {
    case 'Home':     return <IcHome    size={size} color={color} />;
    case 'Explore':  return <IcExplore size={size} color={color} />;
    case 'Messages': return <IcMail    size={size} color={color} />;
    case 'Profile':  return <IcProfile size={size} color={color} />;
    default:         return null;
  }
}

function useUnreadCount() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ['notif-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data).catch(() => ({ count: 0 })),
    refetchInterval: 30_000,
  });
  return data?.count ?? 0;
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const unread = useUnreadCount();

  return (
    <>
      {/* Create bottom sheet */}
      <Modal visible={showCreateSheet} transparent animationType="slide" onRequestClose={() => setShowCreateSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowCreateSheet(false)}>
          <Pressable style={[styles.sheetContainer, { paddingBottom: insets.bottom + 16, backgroundColor: theme.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Créer</Text>
            <TouchableOpacity style={[styles.sheetOption, { backgroundColor: theme.bg }]} activeOpacity={0.8}
              onPress={() => { setShowCreateSheet(false); navigation.navigate('Create'); }}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: theme.primaryBg }]}>
                <IcCreate size={24} color={COLORS.primary} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionTitle, { color: theme.text }]}>Publier une vidéo</Text>
                <Text style={[styles.sheetOptionSub, { color: theme.textMuted }]}>Partage une vidéo avec la communauté</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetOption, { backgroundColor: theme.bg }]} activeOpacity={0.8}
              onPress={() => { setShowCreateSheet(false); navigation.navigate('ThreadComposer'); }}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: theme.primaryBg }]}>
                <IcBrand size={24} color={COLORS.primary} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionTitle, { color: theme.text }]}>Nouveau fil</Text>
                <Text style={[styles.sheetOptionSub, { color: theme.textMuted }]}>Texte, image ou vidéo courte</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetOption, { backgroundColor: theme.bg }]} activeOpacity={0.8}
              onPress={() => { setShowCreateSheet(false); navigation.navigate('GoLive'); }}>
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                <Text style={{ fontSize: 22 }}>🔴</Text>
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionTitle, { color: theme.text }]}>Démarrer un live</Text>
                <Text style={[styles.sheetOptionSub, { color: theme.textMuted }]}>Streaming en direct avec chat</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[
        styles.tabBar,
        { paddingBottom: insets.bottom + 2, backgroundColor: theme.tabBg, borderTopColor: theme.navBorder },
      ]}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const isCreate = route.name === 'Create';

          const onPress = () => {
            if (isCreate) { setShowCreateSheet(true); return; }
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

          const showBadge = route.name === 'Messages' && unread > 0;

          return (
            <TouchableOpacity key={route.key} style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
              <View style={{ position: 'relative' }}>
                <TabIcon name={route.name} focused={isFocused} theme={theme} />
                {showBadge && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, { color: isFocused ? theme.tabActive : theme.tabInactive }, isFocused && styles.tabLabelActive]}>
                {TAB_LABELS[route.name]}
              </Text>
              {isFocused && <View style={[styles.tabDot, { backgroundColor: theme.tabActive }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={FeedScreen} />
      <Tab.Screen name="Explore"  component={ExploreScreen} />
      <Tab.Screen name="Create"   component={CreateScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <AuthStack.Screen name="Login"    component={LoginScreen} />
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
            <RootStack.Screen name="PostDetail" component={PostDetailScreen}
              options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="UserProfile" component={UserProfileScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Conversation" component={ConversationScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: COLORS.white },
                headerTintColor: COLORS.primary,
                headerTitle: '',
                headerShadowVisible: false,
              }} />
            <RootStack.Screen name="Messages" component={MessagesScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Settings" component={SettingsScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="ThreadComposer" component={ThreadComposerScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <RootStack.Screen name="Sound" component={SoundScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <RootStack.Screen name="VideoPlayer" component={VideoPlayerScreen}
              options={{ animation: 'slide_from_bottom' }} />
            <RootStack.Screen name="ThreadDetail" component={ThreadDetailScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="GoLive" component={GoLiveScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <RootStack.Screen name="LiveViewer" component={LiveViewerScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <RootStack.Screen name="LiveList" component={LiveListScreen}
              options={{ animation: 'slide_from_right' }} />
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
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingTop: 8, paddingHorizontal: SPACING.sm,
  },
  notifBadge: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: COLORS.black,
  },
  notifBadgeText: { fontSize: 9, fontWeight: FONT.weight.bold, color: COLORS.white },
  tabItem: { flex: 1, alignItems: 'center', gap: 2, position: 'relative', paddingVertical: 4 },
  tabLabel: { fontSize: 10, fontWeight: FONT.weight.medium },
  tabLabelActive: { fontWeight: FONT.weight.semibold },
  tabDot: {
    position: 'absolute', bottom: -2, width: 4, height: 4,
    borderRadius: 2,
  },
  createBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  createInner: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -12, ...SHADOW.green,
  },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: SPACING.md, gap: 4,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border,
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.bold, color: COLORS.text, marginBottom: 8, paddingHorizontal: 4 },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: SPACING.md, borderRadius: 12,
    backgroundColor: COLORS.bg, marginBottom: 6,
  },
  sheetOptionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetOptionText: { flex: 1, gap: 2 },
  sheetOptionTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.text },
  sheetOptionSub: { fontSize: FONT.size.xs, color: COLORS.textMuted },
});
