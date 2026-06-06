import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface AnimatedPressableProps extends PressableProps {
  scale?: number;
  tension?: number;
  friction?: number;
  haptic?: 'light' | 'medium' | 'none';
  children: React.ReactNode;
}

export function AnimatedPressable({
  scale = 0.88,
  tension = 300,
  friction = 10,
  haptic = 'light',
  onPress,
  children,
  style,
  ...props
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scale,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension,
      friction,
    }).start();
  };

  const handlePress = (e: any) => {
    if (haptic !== 'none') {
      ReactNativeHapticFeedback.trigger(
        haptic === 'medium' ? 'impactMedium' : 'impactLight',
        { enableVibrateFallback: true }
      );
    }
    onPress?.(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style as any]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
