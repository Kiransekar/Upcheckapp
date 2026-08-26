/**
 * ShrimpLogo — the app's brand mark as a scalable vector (replaces the 🦐
 * emoji on the auth screens). A stylised prawn facing right: curled body,
 * tail fan, antennae, walking legs and an eye. Single-colour so it tints to
 * any background; `eyeColor` punches the eye out against a coloured backdrop.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { theme } from '../../theme';

interface Props {
  size?: number;
  color?: string;
  /** Eye fill — set to the background colour so it reads as a cut-out. */
  eyeColor?: string;
}

export const ShrimpLogo = ({
  size = 64,
  color = theme.roles.light.textInverse,
  eyeColor = theme.roles.light.primary,
}: Props) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Curled body */}
    <Path
      d="M7.5 18 C 3.5 15 3 9 7.5 6.5 C 10.5 4.8 14.5 5.2 17 7.5"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      fill="none"
    />
    {/* Tail fan */}
    <Path
      d="M7.5 18 l -2 1.2 M7.5 18 l -0.4 2.3 M7.5 18 l 1.6 1.8"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    />
    {/* Antennae */}
    <Path
      d="M17 7.5 C 19 6 20.5 5.5 22 6 M17 7.5 C 19.5 7.5 21 8.5 22 9.5"
      stroke={color}
      strokeWidth={1.2}
      strokeLinecap="round"
      fill="none"
    />
    {/* Walking legs */}
    <Path
      d="M9 14.6 l -0.6 2 M11 15.4 l -0.4 2 M13 15.5 l -0.2 2"
      stroke={color}
      strokeWidth={1.1}
      strokeLinecap="round"
    />
    {/* Eye */}
    <Circle cx={15.4} cy={8.4} r={1} fill={eyeColor} />
  </Svg>
);

/**
 * BrandLockup — the mark plus the wordmark, side by side. The onboarding
 * designs open with this on every pre-account screen (artboards 01, 02 and the
 * first-run dashboard header), so it lives here rather than being redrawn in
 * three files. "upcheck" is a brand name and is deliberately not translated.
 */
export const BrandLockup = ({ size = 24 }: { size?: number }) => (
  <View style={styles.lockup}>
    <ShrimpLogo
      size={size}
      color={theme.roles.light.primaryHover}
      eyeColor={theme.roles.light.primaryHover}
    />
    <Text style={[styles.wordmark, { fontSize: size * 0.75, lineHeight: size }]}>upcheck</Text>
  </View>
);

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  wordmark: {
    fontFamily: 'Nunito-ExtraBold',
    color: theme.roles.light.primaryHover,
    letterSpacing: -0.4,
  },
});

export default ShrimpLogo;
