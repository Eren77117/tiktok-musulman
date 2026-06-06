import React, { useRef, useEffect, useState } from 'react';
import { Animated, Text, View, TextStyle, Easing } from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: TextStyle;
  speed?: number; // px/s
  containerWidth?: number;
  pauseDuration?: number;
}

export function MarqueeText({
  text,
  style,
  speed = 40,
  containerWidth = 200,
  pauseDuration = 1500,
}: MarqueeTextProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [textWidth, setTextWidth] = useState(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (textWidth <= containerWidth) {
      translateX.setValue(0);
      return;
    }

    const distance = textWidth - containerWidth + 20;
    const duration = (distance / speed) * 1000;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(pauseDuration),
        Animated.timing(translateX, {
          toValue: -distance,
          duration,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
        Animated.delay(pauseDuration),
        Animated.timing(translateX, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animRef.current = anim;
    anim.start();
    return () => anim.stop();
  }, [textWidth, containerWidth, speed, pauseDuration]);

  return (
    <View style={{ width: containerWidth, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          style={style}
          numberOfLines={1}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}
