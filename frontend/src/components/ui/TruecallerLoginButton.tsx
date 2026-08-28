import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Button } from './Button';
import { theme } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const TruecallerLoginButton = ({ onPress, loading, disabled }: Props) => {
  const { t } = useTranslation();
  return (
    <Button
      title={t('auth.continueWithTruecaller')}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      variant="outlined"
      icon={
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name="phone-check" 
            size={20} 
            color="#0087D0"
          />
        </View>
      }
      style={styles.button}
      textStyle={styles.text}
    />
  );
};

const styles = StyleSheet.create({
  button: {
    borderColor: '#0087D0',
    borderWidth: 1.5,
    backgroundColor: theme.roles.light.surface,
    marginTop: theme.spacing[3],
  },
  text: {
    color: '#0087D0',
    fontWeight: '600',
  },
  iconContainer: {
    marginRight: theme.spacing[2],
  },
});
