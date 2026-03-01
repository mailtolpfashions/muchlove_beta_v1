import React from 'react';
import { View, Modal, StyleSheet, ModalProps, DimensionValue } from 'react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, Spacing } from '@/constants/typography';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

interface BottomSheetModalProps extends Omit<ModalProps, 'transparent' | 'animationType'> {
  children: React.ReactNode;
  /** Max height as percentage string e.g. '70%', '85%'. Default '70%'. */
  maxHeight?: DimensionValue;
}

/**
 * Uniform bottom-sheet modal with built-in keyboard avoidance.
 * Replaces manual Keyboard listeners + paddingBottom hacks across settings screens.
 *
 * Usage:
 *   <BottomSheetModal visible={show} onRequestClose={() => setShow(false)}>
 *     <ModalHeader ... />
 *     <ScrollView ...>{form fields}</ScrollView>
 *     <SaveButton ... />
 *   </BottomSheetModal>
 */
export default function BottomSheetModal({ children, maxHeight = '70%', ...rest }: BottomSheetModalProps) {
  const kbHeight = useKeyboardHeight();

  return (
    <Modal animationType="slide" transparent {...rest}>
      <View style={[styles.overlay, kbHeight > 0 && { paddingBottom: kbHeight }]}>
        <View style={[styles.content, { maxHeight }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    padding: Spacing.modal,
    paddingBottom: Spacing.modalBottom,
  },
});
