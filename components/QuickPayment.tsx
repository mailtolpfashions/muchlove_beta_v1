import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Colors } from '@/constants/colors';
import { BorderRadius, FontSize, Spacing } from '@/constants/typography';
import { UpiData } from '@/types';
import { Sparkles, X, Wallet, Smartphone, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { useAlert } from '@/providers/AlertProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = 'amount' | 'method' | 'qr';

interface QuickPaymentProps {
  visible: boolean;
  upiList: UpiData[];
  onPayment: (amount: number, upiId: string, note: string, method: 'cash' | 'gpay') => Promise<void>;
  onClose: () => void;
}

function QuickPayment({ visible, upiList, onPayment, onClose }: QuickPaymentProps) {
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>('amount');
  const [activeUpiIndex, setActiveUpiIndex] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'upi'>('upi');

  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const reset = () => {
    setAmount('');
    setNote('');
    setStep('amount');
    setLoading(false);
    setActiveUpiIndex(0);
    setSelectedMethod('upi');
  };

  const handleProceed = () => {
    if (!isValid) {
      showAlert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    setSelectedMethod('upi');
    setStep('method');
  };

  const handleCash = async () => {
    setLoading(true);
    try {
      await onPayment(parsedAmount, '', note.trim(), 'cash');
      reset();
    } catch (error) {
      console.error('Payment failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpi = () => {
    if (upiList.length === 0) {
      showAlert('No UPI ID configured', 'Please configure a UPI ID in settings.');
      return;
    }
    setActiveUpiIndex(0);
    setStep('qr');
  };

  const handleMethodConfirm = () => {
    if (selectedMethod === 'cash') {
      handleCash();
    } else {
      handleUpi();
    }
  };

  const handleQrDone = async () => {
    setLoading(true);
    try {
      await onPayment(parsedAmount, upiList[activeUpiIndex]?.id || '', note.trim(), 'gpay');
      reset();
    } catch (error) {
      console.error('Payment failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleBack = () => {
    if (step === 'qr') setStep('method');
    else if (step === 'method') setStep('amount');
    else handleClose();
  };

  const handleScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / (SCREEN_WIDTH * 0.65));
    if (slide !== activeUpiIndex) {
      setActiveUpiIndex(slide);
    }
  };

  const qrSize = SCREEN_WIDTH * 0.55;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior="padding"
      >
        <View style={[styles.modalContainer, { paddingBottom: Math.max(40, insets.bottom + Spacing.lg) }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.closeBtn}>
              {step === 'amount' ? (
                <X size={22} color={Colors.text} />
              ) : (
                <ArrowLeft size={22} color={Colors.text} />
              )}
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {step === 'amount' ? 'Quick Payment' : step === 'method' ? 'Choose Payment' : 'Scan to Pay'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Step 1: Amount Entry */}
          {step === 'amount' && (
            <>
              <View style={styles.amountSection}>
                <View style={styles.amountRow}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    autoFocus
                    selectionColor={Colors.primary}
                  />
                </View>
                <View style={styles.divider} />
              </View>

              <View style={styles.quickAmounts}>
                {[50, 100, 200, 500, 1000].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={styles.quickAmountChip}
                    onPress={() => setAmount(String(val))}
                  >
                    <Text style={styles.quickAmountText}>₹{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.noteSection}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add a note (optional)"
                  placeholderTextColor={Colors.textTertiary}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={100}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !isValid && styles.primaryBtnDisabled]}
                onPress={handleProceed}
                disabled={!isValid}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>
                  {isValid ? `Proceed  ₹${parsedAmount}` : 'Enter Amount'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 2: Payment Method */}
          {step === 'method' && (
            <>
              <View style={styles.methodAmountBadge}>
                <Text style={styles.methodAmountText}>₹{parsedAmount}</Text>
                {note.trim() !== '' && <Text style={styles.methodNoteText}>{note}</Text>}
              </View>

              <View style={styles.methodOptions}>
                <TouchableOpacity
                  style={[styles.methodCard, selectedMethod === 'cash' && styles.methodCardSelected]}
                  onPress={() => setSelectedMethod('cash')}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <View style={[styles.methodIcon, { backgroundColor: Colors.successLight }]}>
                    <Wallet size={28} color={Colors.success} />
                  </View>
                  <Text style={styles.methodLabel}>Cash</Text>
                  <Text style={styles.methodDesc}>Record cash payment</Text>
                  {selectedMethod === 'cash' && (
                    <CheckCircle size={18} color={Colors.primary} style={{ position: 'absolute', top: 8, right: 8 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodCard, selectedMethod === 'upi' && styles.methodCardSelected]}
                  onPress={() => setSelectedMethod('upi')}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <View style={[styles.methodIcon, { backgroundColor: Colors.primaryLight }]}>
                    <Smartphone size={28} color={Colors.primary} />
                  </View>
                  <Text style={styles.methodLabel}>Online / UPI</Text>
                  <Text style={styles.methodDesc}>Show QR code to pay</Text>
                  {selectedMethod === 'upi' && (
                    <CheckCircle size={18} color={Colors.primary} style={{ position: 'absolute', top: 8, right: 8 }} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleMethodConfirm}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>
                  {selectedMethod === 'cash' ? 'Confirm Cash Payment' : 'Show QR Code'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 3: QR Code */}
          {step === 'qr' && (
            <>
              <View style={styles.qrSection}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleScroll}
                  contentContainerStyle={styles.qrScrollContent}
                >
                  {upiList.map((upi, index) => {
                    const upiUri = `upi://pay?pa=${upi.upiId}&pn=${encodeURIComponent(upi.payeeName)}&am=${parsedAmount}&cu=INR`;
                    return (
                      <View key={index} style={styles.qrSlide}>
                        <View style={styles.qrCard}>
                          <QRCode value={upiUri} size={qrSize} />
                        </View>
                        <Text style={styles.qrPayeeName}>{upi.payeeName}</Text>
                        <Text style={styles.qrUpiId}>{upi.upiId}</Text>
                      </View>
                    );
                  })}
                </ScrollView>

                {upiList.length > 1 && (
                  <View style={styles.pagination}>
                    {upiList.map((_, i) => (
                      <View key={i} style={[styles.dot, activeUpiIndex === i && styles.activeDot]} />
                    ))}
                  </View>
                )}

                <View style={styles.qrAmountBadge}>
                  <Text style={styles.qrAmountLabel}>Amount</Text>
                  <Text style={styles.qrAmountValue}>₹{parsedAmount}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleQrDone}
                disabled={loading}
                activeOpacity={0.8}
              >
                <CheckCircle size={20} color={Colors.surface} />
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Processing...' : 'Payment Received'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default React.memo(QuickPayment);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.lg,
    minHeight: '55%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.heading,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  // Step 1 styles
  amountSection: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '300' as const,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  divider: {
    width: SCREEN_WIDTH * 0.4,
    height: 2,
    backgroundColor: Colors.primaryLight,
    marginTop: Spacing.md,
    borderRadius: 1,
  },
  quickAmounts: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickAmountChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
  },
  quickAmountText: {
    fontSize: FontSize.body,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noteSection: {
    marginBottom: Spacing.xl,
  },
  noteInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryBtnText: {
    fontSize: FontSize.heading,
    fontWeight: '700' as const,
    color: Colors.surface,
  },
  // Step 2 styles
  methodAmountBadge: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  methodAmountText: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  methodNoteText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  methodOptions: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  methodCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  methodIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  methodLabel: {
    fontSize: FontSize.md,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  methodDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  // Step 3 styles
  qrSection: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  qrScrollContent: {
    alignItems: 'center',
  },
  qrSlide: {
    width: SCREEN_WIDTH - Spacing.lg * 2,
    alignItems: 'center',
  },
  qrCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    elevation: 3,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  qrPayeeName: {
    fontSize: FontSize.md,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  qrUpiId: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  qrAmountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    backgroundColor: Colors.primaryLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: 999,
  },
  qrAmountLabel: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  qrAmountValue: {
    fontSize: FontSize.heading,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 20,
  },
});
