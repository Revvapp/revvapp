import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type UserType = 'detailer' | 'client' | null;

const COLORS = {
  background: '#0D1B2A',
  card: '#1A2B3C',
  gold: '#C9A227',
  white: '#FFFFFF',
  lightGray: '#B7C1CC',
  iconBackground: '#132231',
};

const LETTER_SPACING_WIDE = 2.2;

export default function OnboardingScreen() {
  const [selectedType, setSelectedType] = useState<UserType>(null);

  const handleContinue = () => {
    if (!selectedType) {
      return;
    }

    if (selectedType === 'detailer') {
      router.push('/detailer/onboarding/welcome');
      return;
    }
    router.push('/client/welcome');
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.header}>I AM A...</Text>
        <Text style={styles.subheader}>Choose how you want to use Revv</Text>
      </View>

      <View style={styles.cardsRow}>
        <Pressable
          style={[styles.typeCard, selectedType === 'detailer' && styles.selectedCard]}
          onPress={() => setSelectedType('detailer')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="person-outline" size={18} color={COLORS.white} />
          </View>
          <Text style={styles.cardTitle}>DETAILER</Text>
          <Text style={styles.cardDescription}>
            I detail cars professionally and want to manage my business, get booked, and grow my
            income.
          </Text>
        </Pressable>

        <Pressable
          style={[styles.typeCard, selectedType === 'client' && styles.selectedCard]}
          onPress={() => setSelectedType('client')}
        >
          <View style={styles.iconBox}>
            <Ionicons name="car-outline" size={18} color={COLORS.white} />
          </View>
          <Text style={styles.cardTitle}>CAR OWNER</Text>
          <Text style={styles.cardDescription}>
            I want to find and book a trusted, verified detailer near me for my vehicle.
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.continueButton, !selectedType && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!selectedType}
      >
        <Text style={[styles.continueText, !selectedType && styles.continueTextDisabled]}>CONTINUE</Text>
      </Pressable>

      <Pressable style={styles.loginRow} onPress={() => router.push('/login')}>
        <Text style={styles.loginMuted}>Already have an account? </Text>
        <Text style={styles.loginGold}>Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING_WIDE,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subheader: {
    color: COLORS.lightGray,
    fontSize: 15,
    fontWeight: '500',
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 24,
  },
  typeCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 14,
    minHeight: 260,
  },
  selectedCard: {
    borderColor: COLORS.gold,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.iconBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitle: {
    color: COLORS.white,
    textTransform: 'uppercase',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  cardDescription: {
    color: COLORS.lightGray,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.45,
  },
  continueText: {
    color: COLORS.background,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING_WIDE,
    fontSize: 13,
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
    marginTop: 18,
  },
  loginMuted: {
    color: COLORS.lightGray,
    fontSize: 14,
    fontWeight: '500',
  },
  loginGold: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
