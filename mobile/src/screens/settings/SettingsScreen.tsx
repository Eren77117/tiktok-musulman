import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { RootStackParamList } from '../../navigation';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';
import {
  IcEdit, IcMail, IcShield, IcLock, IcBell, IcUsers, IcGlobe,
  IcMoon, IcHelp, IcLogOut, IcVideo, IcStar, IcFlag, IcInfo,
  IcCheck, IcProfile, IcBack,
} from '../../components/ui/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

type IconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface RowProps {
  Icon: IconComp;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
  last?: boolean;
}

function Row({ Icon, label, value, onPress, right, destructive, last }: RowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && right === undefined}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          <Icon size={18} color={destructive ? COLORS.error : COLORS.primary} strokeWidth={1.8} />
        </View>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {right !== undefined
          ? right
          : onPress
          ? <ChevronRight size={16} color={COLORS.textSubtle} strokeWidth={1.6} />
          : null}
      </View>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ToggleSwitch({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: COLORS.border, true: COLORS.primary }}
      thumbColor={COLORS.white}
      ios_backgroundColor={COLORS.border}
    />
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const [notifPosts, setNotifPosts]         = useState(true);
  const [notifMessages, setNotifMessages]   = useState(true);
  const [notifFollowers, setNotifFollowers] = useState(true);
  const [privateAccount, setPrivateAccount] = useState(false);

  const confirmLogout = () =>
    Alert.alert('Se déconnecter', 'Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <IcBack size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>{user?.display_name?.[0]?.toUpperCase() ?? 'U'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.display_name}</Text>
            <Text style={styles.profileUsername}>@{user?.username}</Text>
          </View>
          {user?.is_verified && (
            <View style={styles.verifiedBadge}>
              <IcCheck size={10} color={COLORS.white} strokeWidth={3} />
            </View>
          )}
        </View>

        <Section title="COMPTE">
          <Row Icon={IcEdit}    label="Modifier le profil" onPress={() => Alert.alert('Bientôt', 'Édition du profil dans la prochaine mise à jour.')} />
          <Row Icon={IcMail}    label="Email" value={user?.email} />
          <Row Icon={IcProfile} label="Genre" value={user?.gender === 'MALE' ? 'Homme' : 'Femme'} />
          <Row Icon={IcStar}    label="Statut" value={user?.is_verified ? 'Vérifié ✓' : 'Standard'} last />
        </Section>

        <Section title="SÉCURITÉ">
          <Row Icon={IcLock}   label="Changer le mot de passe" onPress={() => Alert.alert('Mot de passe', `Un e-mail sera envoyé à ${user?.email}`)} />
          <Row Icon={IcShield} label="Double authentification" value="Désactivée" last />
        </Section>

        <Section title="NOTIFICATIONS">
          <Row Icon={IcVideo}   label="Nouvelles publications"    right={<ToggleSwitch value={notifPosts}      onValueChange={setNotifPosts} />} />
          <Row Icon={IcMail}    label="Nouveaux messages"         right={<ToggleSwitch value={notifMessages}   onValueChange={setNotifMessages} />} />
          <Row Icon={IcUsers}   label="Nouveaux abonnés"          right={<ToggleSwitch value={notifFollowers}  onValueChange={setNotifFollowers} />} last />
        </Section>

        <Section title="CONFIDENTIALITÉ">
          <Row Icon={IcLock}  label="Compte privé" right={<ToggleSwitch value={privateAccount} onValueChange={setPrivateAccount} />} />
          <Row Icon={IcUsers} label="Blocages"     value="Aucun" last />
        </Section>

        <Section title="APPARENCE">
          <Row Icon={IcMoon}  label="Mode sombre" right={<ToggleSwitch value={isDark} onValueChange={toggleTheme} />} />
          <Row Icon={IcGlobe} label="Langue"      value="Français" last />
        </Section>

        <Section title="AIDE & INFOS">
          <Row Icon={IcHelp} label="Aide & Support" onPress={() => Linking.openURL('mailto:support@nour.app')} />
          <Row Icon={IcFlag} label="Signaler un problème" onPress={() => Linking.openURL('mailto:support@nour.app?subject=Bug')} />
          <Row Icon={IcInfo} label="Version" value="1.0.0 beta" last />
        </Section>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.8}>
          <IcLogOut size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.white,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  content: { padding: SPACING.md, gap: SPACING.md },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight,
    ...SHADOW.sm, position: 'relative',
  },
  profileAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: COLORS.primaryBg, borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitial: { fontSize: 22, fontWeight: FONT.weight.bold, color: COLORS.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.text },
  profileUsername: { fontSize: FONT.size.sm, color: COLORS.textMuted },
  verifiedBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },

  section: { gap: 6 },
  sectionTitle: {
    fontSize: FONT.size.xs, fontWeight: FONT.weight.semibold,
    color: COLORS.textSubtle, letterSpacing: 1, paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden', ...SHADOW.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: { fontSize: FONT.size.base, color: COLORS.text },
  rowLabelDestructive: { color: COLORS.error },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontSize: FONT.size.sm, color: COLORS.textMuted },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    paddingVertical: 14,
    borderWidth: 1.5, borderColor: COLORS.error,
  },
  logoutText: { fontSize: FONT.size.base, fontWeight: FONT.weight.semibold, color: COLORS.error },
});
