import React, { useState, useRef } from 'react';
import { View, Image, Animated, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { COLORS } from '../../constants/theme';

interface Props {
  uri: string | null | undefined;
  style?: ImageStyle | ViewStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallbackColor?: string;
  borderRadius?: number;
}

export function LazyImage({ uri, style, resizeMode = 'cover', fallbackColor, borderRadius }: Props) {
  const [loaded, setLoaded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const onLoad = () => {
    setLoaded(true);
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  return (
    <View style={[styles.container, { borderRadius }, style as ViewStyle]}>
      {/* Placeholder shimmer */}
      {!loaded && (
        <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: fallbackColor ?? COLORS.border, borderRadius }]} />
      )}
      {uri ? (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity, borderRadius }]}
          resizeMode={resizeMode}
          onLoad={onLoad}
          onError={() => setLoaded(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  placeholder: { opacity: 0.5 },
});
