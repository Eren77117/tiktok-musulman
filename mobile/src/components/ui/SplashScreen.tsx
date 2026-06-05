import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { IcBrand } from './Icons';
import { COLORS, FONT } from '../../constants/theme';
import { CHANGELOG } from '../../constants/changelog';

const APP_VERSION = CHANGELOG[0]?.version ?? '2.2.0';

const { width: W } = Dimensions.get('window');

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  // Animations
  const logoScale = useRef(new Animated.Value(0.4)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(14)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Dots pulse animations
  const dot1 = useRef(new Animated.Value(0.2)).current;
  const dot2 = useRef(new Animated.Value(0.2)).current;
  const dot3 = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const dotPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(anim, { toValue: 0.2, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.delay(400 - delay),
        ])
      );

    // Logo bounce: 0.4 → 1.08 → 1
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1.08,
          useNativeDriver: true,
          tension: 160,
          friction: 7,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.ease),
        }),
      ]),
      Animated.spring(logoScale, {
        toValue: 1, useNativeDriver: true, tension: 200, friction: 8,
      }),
    ]).start();

    // Wordmark fade + slide up — delay 380ms
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 380, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(wordmarkY, { toValue: 0, duration: 380, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start();
    }, 380);

    // Tagline — delay 560ms
    setTimeout(() => {
      Animated.timing(taglineOpacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    }, 560);

    // Loading dots — delay 750ms
    setTimeout(() => {
      Animated.timing(dotsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      dotPulse(dot1, 0).start();
      dotPulse(dot2, 200).start();
      dotPulse(dot3, 400).start();
    }, 750);

    // Exit — after 1800ms
    const exitTimer = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start(() => onDone());
    }, 1800);

    return () => clearTimeout(exitTimer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Logo circle */}
      <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
        <View style={styles.logoCircle}>
          <IcBrand size={38} color={COLORS.primary} />
        </View>
      </Animated.View>

      {/* App name */}
      <Animated.Text style={[styles.appName, { opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] }]}>
        Nour
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Partage · Inspire · Élève
      </Animated.Text>

      {/* Loading dots + version */}
      <Animated.View style={[styles.bottomArea, { opacity: dotsOpacity }]}>
        <View style={styles.dots}>
          {[dot1, dot2, dot3].map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
          ))}
        </View>
        <Text style={styles.version}>v{APP_VERSION}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    backgroundColor: '#090E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: { marginBottom: 20 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 26,
    backgroundColor: '#0F2018',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#1A3828',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
    marginBottom: 8,
    fontFamily: undefined, // uses system default
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 3,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  bottomArea: {
    position: 'absolute',
    bottom: 52,
    alignItems: 'center',
    gap: 12,
  },
  dots: { flexDirection: 'row', gap: 7 },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  version: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: 1,
  },
});
