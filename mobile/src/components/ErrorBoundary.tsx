import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, FONT, SPACING, RADIUS } from '../constants/theme';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null; info: ErrorInfo | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    if (__DEV__) console.warn('[ErrorBoundary]', error.message, info.componentStack?.slice(0, 300));
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        {/* Warning icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconGlyph}>!</Text>
        </View>

        <Text style={styles.title}>Quelque chose s'est mal passé</Text>
        <Text style={styles.subtitle}>
          Une erreur inattendue est survenue.{'\n'}Appuie sur "Réessayer" pour continuer.
        </Text>

        {/* Error message (dev-visible) */}
        {this.state.error && (
          <View style={styles.errorBox}>
            <ScrollView style={{ maxHeight: 90 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.errorText} selectable>
                {this.state.error.message}
              </Text>
            </ScrollView>
          </View>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={() => this.setState({ hasError: false, error: null, info: null })}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080D09',
    padding: SPACING.xl,
    gap: 0,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(232,144,10,0.12)',
    borderWidth: 2, borderColor: 'rgba(232,144,10,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconGlyph: {
    fontSize: 28, fontWeight: '900', color: '#E8900A',
  },
  title: {
    fontSize: 20,
    fontWeight: FONT.weight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    width: '100%',
    marginBottom: 28,
  },
  errorText: {
    fontSize: 11,
    color: '#E8900A',
    lineHeight: 16,
  },
  btn: {
    height: 50,
    borderRadius: 100,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  btnText: {
    fontSize: 16,
    fontWeight: FONT.weight.bold,
    color: '#FFFFFF',
  },
});
