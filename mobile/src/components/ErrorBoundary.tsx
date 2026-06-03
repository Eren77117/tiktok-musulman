import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONT, SPACING, RADIUS } from '../constants/theme';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.warn('[ErrorBoundary]', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.message}>L'application a rencontré un problème.</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: '' })}
            activeOpacity={0.8}
          >
            <Text style={styles.btnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg, padding: SPACING.xl, gap: SPACING.md,
  },
  title: { fontSize: FONT.size.xl, fontWeight: FONT.weight.bold, color: COLORS.text, textAlign: 'center' },
  message: { fontSize: FONT.size.base, color: COLORS.textMuted, textAlign: 'center' },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: 14,
  },
  btnText: { color: COLORS.white, fontSize: FONT.size.base, fontWeight: FONT.weight.semibold },
});
