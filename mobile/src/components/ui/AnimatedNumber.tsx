import React, { useRef, useEffect } from 'react';
import { Animated, TextStyle } from 'react-native';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface AnimatedNumberProps {
  value: number;
  formatter?: (n: number) => string;
  style?: TextStyle;
}

export function AnimatedNumber({ value, formatter = fmt, style }: AnimatedNumberProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.4,
          useNativeDriver: true,
          tension: 600,
          friction: 5,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
      ]).start();
    }
  }, [value]);

  return (
    <Animated.Text style={[style, { transform: [{ scale: scaleAnim }] }]}>
      {formatter(value)}
    </Animated.Text>
  );
}
