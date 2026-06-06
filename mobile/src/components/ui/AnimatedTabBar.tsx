import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { COLORS, FONT } from '../../constants/theme';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface AnimatedTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  scrollable?: boolean;
  underlineColor?: string;
  variant?: 'light' | 'dark';
}

export function AnimatedTabBar({
  tabs,
  activeTab,
  onTabChange,
  scrollable = false,
  underlineColor = COLORS.primary,
  variant = 'light',
}: AnimatedTabBarProps) {
  const theme = useTheme();
  const underlineX = useRef(new Animated.Value(0)).current;
  const tabWidthsRef = useRef<Record<string, number>>({});
  const tabOffsetsRef = useRef<Record<string, number>>({});

  const animateToTab = (key: string) => {
    const offset = tabOffsetsRef.current[key] ?? 0;
    const width = tabWidthsRef.current[key] ?? 60;
    Animated.spring(underlineX, {
      toValue: offset + (width - 40) / 2,
      useNativeDriver: true,
      stiffness: 420,
      damping: 34,
    }).start();
  };

  useEffect(() => {
    // Small delay to ensure layouts are measured
    const t = setTimeout(() => animateToTab(activeTab), 50);
    return () => clearTimeout(t);
  }, [activeTab]);

  const textColor = (isActive: boolean) =>
    isActive
      ? (variant === 'dark' ? '#fff' : theme.text)
      : (variant === 'dark' ? 'rgba(255,255,255,0.5)' : theme.textMuted);

  const tabItem = (tab: Tab) => {
    const isActive = tab.key === activeTab;
    return (
      <TouchableOpacity
        key={tab.key}
        onPress={() => onTabChange(tab.key)}
        activeOpacity={0.7}
        onLayout={(e) => {
          tabWidthsRef.current[tab.key] = e.nativeEvent.layout.width;
          tabOffsetsRef.current[tab.key] = e.nativeEvent.layout.x;
        }}
        style={{
          paddingHorizontal: scrollable ? 16 : 0,
          flex: scrollable ? undefined : 1,
          alignItems: 'center',
          paddingVertical: 11,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Text style={{
          fontSize: FONT.size.sm,
          fontWeight: isActive ? FONT.weight.bold : FONT.weight.medium,
          color: textColor(isActive),
        }}>
          {tab.label}
        </Text>
        {tab.count !== undefined && tab.count > 0 && (
          <View style={{
            minWidth: 16, height: 16, borderRadius: 8,
            backgroundColor: '#FF3B30',
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 3,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
              {tab.count > 9 ? '9+' : tab.count}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ position: 'relative' }}>
      {scrollable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row' }}
        >
          {tabs.map(tabItem)}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: 'row' }}>
          {tabs.map(tabItem)}
        </View>
      )}

      {/* Animated underline */}
      <Animated.View style={{
        position: 'absolute',
        bottom: 0,
        width: 40,
        height: 2.5,
        borderRadius: 2,
        backgroundColor: variant === 'dark' ? '#fff' : underlineColor,
        transform: [{ translateX: underlineX }],
      }} />

      {/* Border bottom */}
      <View style={{ height: 1, backgroundColor: theme.borderLight }} />
    </View>
  );
}
