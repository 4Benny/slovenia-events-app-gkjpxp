import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import * as Brand from '@/constants/Colors';

export const colors = {
  primary: Brand.secondaryGradientEnd,
  secondary: Brand.secondaryGradientStart,
  accent: Brand.accentOrange,
  background: Brand.primaryGradientStart,
  backgroundAlt: Brand.surfaceDark,
  text: Brand.textPrimary,
  grey: Brand.textSecondary,
  card: Brand.surfaceDark,
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.backgroundAlt,
    borderColor: Brand.borderSubtle,
    borderWidth: 1,
    borderRadius: Brand.borderRadiusCard,
    padding: 10,
    marginVertical: 8,
    width: '100%',
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: Brand.textPrimary,
  },
});
