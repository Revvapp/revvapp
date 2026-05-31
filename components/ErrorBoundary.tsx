import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const C = {
  bg:    '#0A1628',
  gold:  '#C9A227',
  white: '#FFFFFF',
  gray:  '#8A9BB0',
  navy:  '#1A3A5C',
};

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Catches render-time crashes anywhere below it and shows a branded fallback
 * instead of a raw error / stack trace. Async errors (event handlers, promises)
 * are not caught here — those are handled with try/catch at their call sites.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Report to Sentry when configured; a no-op otherwise.
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    if (__DEV__) {
      console.error('Caught by ErrorBoundary:', error);
    }
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconRing}>
          <Ionicons name="warning-outline" size={34} color={C.gold} />
        </View>

        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          We hit an unexpected snag. Your data is safe — give it another try.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={this.reset}
        >
          <Ionicons name="refresh" size={18} color={C.navy} />
          <Text style={styles.btnText}>Try Again</Text>
        </Pressable>

        <View style={styles.brandWrap}>
          <Text style={styles.brand}>
            <Text style={styles.brandWhite}>RE</Text>
            <Text style={styles.brandGold}>VV</Text>
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
  },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: C.gold,
    backgroundColor: 'rgba(201,162,39,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: C.white,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: C.gray,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.gold,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnPressed: { opacity: 0.85 },
  btnText: { color: C.navy, fontSize: 15, fontWeight: '900' },
  brandWrap: {
    position: 'absolute',
    bottom: 48,
  },
  brand: { fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  brandWhite: { color: C.white },
  brandGold: { color: C.gold },
});
