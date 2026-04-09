/**
 * SopranoChat — Global Error Boundary
 * Native modül crash'lerini yakalayıp kullanıcıyı bilgilendirir,
 * uygulamanın kapanmasını önler.
 */
import React, { Component, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Crash yakalandı:', error.message);
    console.error('[ErrorBoundary] Component Stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    try { router.replace('/(tabs)/home'); } catch { /* silent */ }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={48} color="#F59E0B" />
            </View>
            <Text style={styles.title}>{this.props.fallbackTitle || 'Bir Hata Oluştu'}</Text>
            <Text style={styles.message}>
              Bu ekran beklenmedik bir hata ile karşılaştı.{'\n'}Lütfen tekrar deneyin veya ana sayfaya dönün.
            </Text>
            {/* Production'da detaylı hata gösterme — güvenlik riski */}
            {__DEV__ && (
              <ScrollView style={styles.errorBox} showsVerticalScrollIndicator={false}>
                <Text style={styles.errorText}>
                  {this.state.error?.message || 'Bilinmeyen hata'}
                </Text>
                {this.state.error?.stack && (
                  <Text style={[styles.errorText, { fontSize: 9, marginTop: 8 }]}>
                    {this.state.error.stack.slice(0, 500)}
                  </Text>
                )}
              </ScrollView>
            )}
            <View style={styles.btnRow}>
              <Pressable style={styles.retryBtn} onPress={this.handleReset}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.retryText}>Tekrar Dene</Text>
              </Pressable>
              <Pressable style={styles.homeBtn} onPress={this.handleGoHome}>
                <Ionicons name="home" size={18} color="#fff" />
                <Text style={styles.retryText}>Ana Sayfa</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'rgba(20,25,35,0.95)',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18, fontWeight: '700', color: '#F8FAFC',
    marginBottom: 8, textAlign: 'center',
  },
  message: {
    fontSize: 13, color: '#94A3B8', textAlign: 'center',
    lineHeight: 20, marginBottom: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    maxHeight: 120,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 11, color: '#EF4444', fontFamily: 'monospace',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#14B8A6',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, flex: 1,
    justifyContent: 'center',
  },
  homeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, flex: 1,
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row', gap: 10, width: '100%',
  },
  retryText: {
    fontSize: 14, fontWeight: '600', color: '#fff',
  },
});
