import React from 'react';
import { Text, StyleSheet } from 'react-native';

const MAP: Record<string, string> = {
  bell:       '⊙',
  mail:       '⊡',
  chat:       '◻',
  heart:      '♥',
  'heart-fill': '♥',
  play:       '▶',
  search:     '⌕',
  close:      '✕',
  check:      '✓',
  plus:       '+',
  back:       '‹',
  forward:    '›',
  arrow_right: '→',
  arrow_left:  '←',
  arrow_up:   '↑',
  share:      '⤴',
  save:       '◇',
  settings:   '⊛',
  edit:       '◊',
  lock:       '◈',
  star:       '☆',
  'star-fill': '★',
  music:      '♪',
  video:      '▶',
  camera:     '◉',
  moon:       '☽',
  dot:        '·',
  verified:   '✓',
  male:       'H',
  female:     'F',
  grid:       '▦',
  list:       '≡',
  filter:     '⊟',
  alert:      '⊗',
  info:       '⊘',
  link:       '⊞',
  trash:      '⊟',
};

interface IconProps {
  name: keyof typeof MAP;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = '#000' }: IconProps) {
  const char = MAP[name] ?? '·';
  return (
    <Text style={[styles.icon, { fontSize: size, color }]} allowFontScaling={false}>
      {char}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: { fontWeight: '400', lineHeight: undefined },
});
