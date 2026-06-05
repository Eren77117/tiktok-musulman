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
  IcProfile, IcBrand, IcLive, IcPen, IcVideo, IcBell,
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
import FollowersScreen from '../screens/profile/FollowersScreen';
import HashtagScreen from '../screens/explore/HashtagScreen';
import CreatorStatsScreen from '../screens/profile/CreatorStatsScreen';
import StoriesScreen from '../screens/feed/StoriesScreen';
import SearchScreen from '../screens/search/SearchScreen';
import StoryCreateScreen from '../screens/stories/StoryCreateScreen';
import StoryViewerScreen from '../screens/stories/StoryViewerScreen';
import StoryArchiveScreen from '../screens/stories/StoryArchiveScreen';

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
  Followers: { userId: string; username: string; type: 'followers' | 'following' };
  Hashtag: { tag: string };
  CreatorStats: undefined;
  Stories: { userId: string };
  Search: undefined;
  StoryCreate: undefined;
  StoryViewer: { groups: any[]; initialGroupIndex?: number };
  StoryArchive: undefined;
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
  Home: 'Accueil', Explore: 'Explorer', Create: '', Messages: 'Messages', Profile: 'Profil',
};

function TabIcon({ name, focused, theme }: { name: string; focused: boolean; theme: any }) {
  const color = focused ? theme.tabActive : theme.tabInactive;
  const sw = focused ? 1.8 : 1.5;
  switch (name) {
    case 'Home':     return <IcHome    size={22} color={color} strokeWidth={sw} />;
    case 'Explore':  return <IcExplore size={22} color={color} strokeWidth={sw} />;
    case 'Messages': return <IcMail    size={22} color={color} strokeWidth={sw} />;
    case 'Profile':  return <IcProfile size={22} color={color} strokeWidth={sw} />;
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
          <Pressable style={[styles.sheetContainer, {
            paddingBottom: insets.bottom + 20,
            backgroundColor: theme.isDark ? '#131313' : theme.surface,
            borderTopColor: theme.border,
          }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.isDark ? '#333' : theme.border }]} />
            <Text style={[styles.sheetTitle, { color: theme.text }]}>Créer du contenu</Text>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: theme.card, borderColor: theme.border }]}
              activeOpacity={0.75}
              onPress={() => { setShowCreateSheet(false); navigation.navigate('Create'); }}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: theme.primaryBg }]}>
                <IcVideo size={20} color={COLORS.primary} strokeWidth={1.5} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionTitle, { color: theme.text }]}>Publier une vidéo</Text>
                <Text style={[styles.sheetOptionSub, { color: theme.textMuted }]}>Partage une vidéo avec la communauté</Text>
              </View>
              <View style={styles.sheetArrow}><Text style={{ color: theme.textSubtle, fontSize: 16 }}>›</Text></View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: theme.card, borderColor: theme.border }]}
              activeOpacity={0.75}
              onPress={() => { setShowCreateSheet(false); navigation.navigate('ThreadComposer'); }}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: theme.primaryBg }]}>
                <IcPen size={24} color={COLORS.primary} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionTitle, { color: theme.text }]}>Nouveau fil</Text>
                <Text style={[styles.sheetOptionSub, { color: theme.textMuted }]}>Texte, image ou vidéo courte</Text>
              </View>
              <View style={styles.sheetArrow}><Text style={{ color: theme.textSubtle, fontSize: 16 }}>›</Text></View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetOption, { backgroundColor: theme.card, borderColor: theme.border }]}
              activeOpacity={0.75}
              onPress={() => { setShowCreateSheet(false); navigation.navigate('GoLive'); }}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: '#1A0000' }]}>
                <IcLive size={24} color="#FF3B30" />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={[styles.sheetOptionTitle, { color: theme.text }]}>Démarrer un live</Text>
                <Text style={[styles.sheetOptionSub, { color: theme.textMuted }]}>Streaming en direct avec chat</Text>
              </View>
              <View style={styles.sheetArrow}><Text style={{ color: theme.textSubtle, fontSize: 16 }}>›</Text></View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Tab bar */}
      <View style={[styles.tabBar, {
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        backgroundColor: theme.tabBg,
        borderTopColor: theme.navBorder,
      }]}>
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
              <TouchableOpacity key={route.key} style={styles.createBtnWrap} onPress={onPress} activeOpacity={0.85}>
                <View style={[styles.createInner, SHADOW.green]}>
                  <IcCreate size={20} color={COLORS.white} strokeWidth={2.2} />
                </View>
              </TouchableOpacity>
            );
          }

          const showBadge = route.name === 'Messages' && unread > 0;

          return (
            <TouchableOpacity key={route.key} style={styles.tabItem} onPress={onPress} activeOpacity={0.7}>
              <View style={styles.iconWrap}>
                {isFocused && (
                  <View style={[styles.activeGlow, { backgroundColor: `${COLORS.primary}18` }]} />
                )}
                <TabIcon name={route.name} focused={isFocused} theme={theme} />
                {showBadge && (
                  <View style={[styles.notifBadge, { borderColor: theme.tabBg }]}>
                    <Text style={styles.notifBadgeText}>{unread > 99 ? '99+' : String(unread)}</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.tabLabel,
                { color: isFocused ? theme.tabActive : theme.tabInactive },
                isFocused && styles.tabLabelActive,
              ]}>
                {TAB_LABELS[route.name]}
              </Text>
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
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingLogo}>
          <IcBrand size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, gestureDirection: 'horizontal' }}>
        {user ? (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="PostDetail" component={PostDetailScreen}
              options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }} />
            <RootStack.Screen name="UserProfile" component={UserProfileScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="Conversation" component={ConversationScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#0B0B0B' },
                headerTintColor: COLORS.primary,
                headerTitle: '',
                headerShadowVisible: false,
                gestureEnabled: true,
              }} />
            <RootStack.Screen name="Messages" component={MessagesScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="Notifications" component={NotificationsScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="Settings" component={SettingsScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="ThreadComposer" component={ThreadComposerScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal', gestureEnabled: true }} />
            <RootStack.Screen name="Sound" component={SoundScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal', gestureEnabled: true }} />
            <RootStack.Screen name="VideoPlayer" component={VideoPlayerScreen}
              options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical', gestureEnabled: true }} />
            <RootStack.Screen name="ThreadDetail" component={ThreadDetailScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="GoLive" component={GoLiveScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <RootStack.Screen name="LiveViewer" component={LiveViewerScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
            <RootStack.Screen name="LiveList" component={LiveListScreen}
              options={{ animation: 'slide_from_right' }} />
            <RootStack.Screen name="Followers" component={FollowersScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="Hashtag" component={HashtagScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="CreatorStats" component={CreatorStatsScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="Stories" component={StoriesScreen}
              options={{ animation: 'fade', presentation: 'fullScreenModal', gestureEnabled: false }} />
            <RootStack.Screen name="Search" component={SearchScreen}
              options={{ animation: 'slide_from_right', gestureEnabled: true }} />
            <RootStack.Screen name="StoryCreate" component={StoryCreateScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <RootStack.Screen name="StoryViewer" component={StoryViewerScreen}
              options={{ animation: 'fade', presentation: 'fullScreenModal', headerShown: false }} />
            <RootStack.Screen name="StoryArchive" component={StoryArchiveScreen}
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
    flex: 1, backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center',
  },
  loadingLogo: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#001F12',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#00C26E40',
    shadowColor: '#00C26E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2,
  },
  iconWrap: {
    width: 44, height: 36, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  activeGlow: {
    position: 'absolute', width: 40, height: 32, borderRadius: 10,
  },
  tabLabel: {
    fontSize: 10, fontWeight: FONT.weight.medium, letterSpacing: 0.1,
  },
  tabLabelActive: { fontWeight: FONT.weight.semibold },

  notifBadge: {
    position: 'absolute', top: 0, right: -2,
    minWidth: 15, height: 15, borderRadius: 7.5,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#0B0B0B',
  },
  notifBadgeText: { fontSize: 8, fontWeight: FONT.weight.bold, color: '#fff' },

  createBtnWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  createInner: {
    width: 48, height: 48, borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -16,
  },

  // Create sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheetContainer: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingTop: 12,
    gap: 8,
    borderTopWidth: 0.5,
  },
  sheetHandle: {
    width: 32, height: 3, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: {
    fontSize: FONT.size.lg, fontWeight: FONT.weight.bold,
    marginBottom: 4, paddingHorizontal: 4, letterSpacing: -0.3,
  },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 14,
    borderWidth: 0.5, marginBottom: 2,
  },
  sheetOptionIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetOptionText: { flex: 1, gap: 2 },
  sheetOptionTitle: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, letterSpacing: -0.2 },
  sheetOptionSub: { fontSize: FONT.size.xs, lineHeight: 16 },
  sheetArrow: { width: 20, alignItems: 'center' },
});
