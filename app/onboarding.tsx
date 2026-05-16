import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type UserType = 'detailer' | 'client' | null;

const COLORS = {
  background: '#0D1B2A',
  card: '#111E2B',
  cardClient: '#0F1C2E',
  gold: '#C9A227',
  white: '#FFFFFF',
  lightGray: '#8FA3B1',
  detailerIconBg: '#2A2510',
  clientIconBg: '#0F2744',
};

const LETTER_SPACING_WIDE = 2.2;

export default function OnboardingScreen() {
  const [selectedType, setSelectedType] = useState<UserType>(null);

  const handleContinue = () => {
    if (!selectedType) return;
    if (selectedType === 'detailer') {
      router.push('/detailer/onboarding/welcome');
      return;
    }
    router.push('/client/welcome');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.header}>I AM A...</Text>
        <Text style={styles.subheader}>Choose how you want to use Revv</Text>
      </View>

      <View style={styles.cardsStack}>
        <Pressable
          style={[styles.typeCard, selectedType === 'detailer' && styles.selectedCard]}
          onPress={() => setSelectedType('detailer')}
        >
          <View style={[styles.iconBox, styles.detailerIconBox]}>
            <Ionicons name="person" size={24} color={COLORS.gold} />
          </View>
          <Text style={styles.cardTitle}>DETAILER</Text>
          <Text style={styles.cardDescription}>
            I detail cars professionally and want to manage my business, get booked, and grow my
            income.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.typeCard, styles.cardClient, selectedType === 'client' && styles.selectedCard]}
          onPress={() => setSelectedType('client')}
        >
          <View style={[styles.iconBox, styles.clientIconBox]}>
            <Ionicons name="terminal" size={22} color="#5A9FD4" />
          </View>
          <Text style={styles.cardTitle}>CAR OWNER</Text>
          <Text style={styles.cardDescription}>
            I want to find and book a trusted, verified detailer near me for my vehicle.
          </Text>
        </Pressable>
      </View>

      <View style={styles.bottomBlock}>
        <Pressable
          style={[styles.continueButton, !selectedType && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedType}
        >
          <Text style={[styles.continueText, !selectedType && styles.continueTextDisabled]}>
            CONTINUE
          </Text>
        </Pressable>

        <Pressable style={styles.loginRow} onPress={() => router.push('/login')}>
          <Text style={styles.loginMuted}>Already have an account? </Text>
          <Text style={styles.loginGold}>Log in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  header: {
    color: COLORS.white,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING_WIDE,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
  },
  subheader: {
    color: COLORS.lightGray,
    fontSize: 15,
    fontWeight: '400',
  },
  cardsStack: {
    flex: 1,
    gap: 14,
    marginTop: 32,
    marginBottom: 32,
  },
  typeCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 22,
  },
  cardClient: {
    backgroundColor: COLORS.cardClient,
  },
  selectedCard: {
    borderColor: COLORS.gold,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  detailerIconBox: {
    backgroundColor: COLORS.detailerIconBg,
  },
  clientIconBox: {
    backgroundColor: COLORS.clientIconBg,
  },
  cardTitle: {
    color: COLORS.white,
    textTransform: 'uppercase',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  cardDescription: {
    color: COLORS.lightGray,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '400',
  },
  bottomBlock: {
    gap: 16,
  },
  continueButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.45,
  },
  continueText: {
    color: COLORS.background,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING_WIDE,
    fontSize: 14,
    fontWeight: '800',
  },
  continueTextDisabled: {
    color: '#2B3D4F',
  },
  loginRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginMuted: {
    color: COLORS.lightGray,
    fontSize: 14,
    fontWeight: '400',
  },
  loginGold: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
