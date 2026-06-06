import React, { useRef, useState, useCallback } from 'react';
import { Animated, Text, View, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONT, RADIUS } from '../../constants/theme';
import { IcCheck, IcClose } from './Icons';

const { width: W } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

// Global singleton ref
let toastRef: { show: (message: string, type?: ToastType, duration?: number) => void } | null = null;

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  toastRef?.show(message, type, duration);
}

export function ToastProvider() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ToastState>({ message: '', type: 'info', visible: false });
  const translateY = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ message, type, visible: true });

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      stiffness: 400,
      damping: 30,
    }).start();

    timerRef.current = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setState(s => ({ ...s, visible: false })));
    }, duration);
  }, []);

  // Register global ref
  React.useEffect(() => {
    toastRef = { show };
    return () => { toastRef = null; };
  }, [show]);

  if (!state.visible) return null;

  const bgColor = state.type === 'success' ? '#1A5C35'
    : state.type === 'error' ? '#7F1D1D'
    : '#1A1A2E';

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, backgroundColor: bgColor, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      {state.type === 'success' && <IcCheck size={16} color="#fff" strokeWidth={2.5} />}
      {state.type === 'error' && <IcClose size={16} color="#fff" strokeWidth={2.5} />}
      <Text style={styles.text}>{state.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 7000,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  text: {
    flex: 1,
    fontSize: FONT.size.sm,
    fontWeight: '600',
    color: '#fff',
    lineHeight: 18,
  },
});
