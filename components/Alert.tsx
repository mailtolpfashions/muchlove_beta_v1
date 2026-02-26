import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';

interface AlertProps {
  isVisible: boolean;
  title: string;
  message: string;
  cancelText?: string;
  confirmText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const Alert: React.FC<AlertProps> = ({ isVisible, title, message, cancelText, confirmText, onCancel, onConfirm }) => {
  if (!isVisible) return null;

  return (
    <Modal transparent animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonsContainer}>
            {cancelText && (
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={[styles.buttonText, styles.cancelButtonText]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            {confirmText && (
              <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={onConfirm}>
                <Text style={[styles.buttonText, styles.confirmButtonText]}>{confirmText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.title,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginLeft: Spacing.sm,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmButton: {
    backgroundColor: Colors.danger,
  },
  buttonText: {
    fontSize: FontSize.body,
    fontWeight: '500',
  },
  cancelButtonText: {
    color: Colors.text,
  },
  confirmButtonText: {
    color: Colors.surface,
  },
});
