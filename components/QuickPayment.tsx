import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { UpiData } from '@/types';
import { Zap } from 'lucide-react-native';

interface QuickPaymentProps {
  upiList: UpiData[];
  onPayment: (amount: number, upiId: string, note: string) => Promise<void>;
}

export default function QuickPayment({ upiList, onPayment }: QuickPaymentProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const handlePayment = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (upiList.length === 0) {
      Alert.alert('No UPI ID configured', 'Please configure a UPI ID in settings.');
      return;
    }

    try {
      await onPayment(parsedAmount, upiList[0].id, note.trim());
      setAmount('');
      setNote('');
    } catch (error) {
      console.error('Payment failed', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Zap size={20} color={Colors.primary} />
        <Text style={styles.title}>Quick Payment</Text>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.amountInput}
          placeholder="Amount (₹)"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.noteInput}
          placeholder="Note (optional)"
          placeholderTextColor={Colors.textTertiary}
          value={note}
          onChangeText={setNote}
        />
      </View>
      <TouchableOpacity
        style={[styles.payButton, (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) && styles.payButtonDisabled]}
        onPress={handlePayment}
        disabled={!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
      >
        <Text style={styles.payButtonText}>Record Quick Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '600',
    color: Colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  amountInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.lg,
    height: 48,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  noteInput: {
    flex: 2,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.lg,
    height: 48,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: Colors.border,
  },
  payButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.surface,
  },
});
