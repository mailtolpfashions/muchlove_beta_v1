import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { FontSize, Spacing, BorderRadius } from '@/constants/typography';

type AlertType = 'error' | 'warning' | 'success' | 'info' | 'confirm';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  buttons: AlertButton[];
}

interface AlertContextType {
  showAlert: (title: string, message: string, type?: AlertType) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
  ) => void;
}

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
  showConfirm: () => {},
});

export const useAlert = () => useContext(AlertContext);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [],
  });

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 300,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAlert(prev => ({ ...prev, visible: false }));
    });
  }, [scaleAnim, opacityAnim]);

  const showAlert = useCallback(
    (title: string, message: string, type: AlertType = 'error') => {
      setAlert({
        visible: true,
        type,
        title,
        message,
        buttons: [{ text: 'OK', style: 'default' }],
      });
      setTimeout(animateIn, 10);
    },
    [],
  );

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm') => {
      setAlert({
        visible: true,
        type: 'confirm',
        title,
        message,
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: confirmText, style: 'destructive', onPress: onConfirm },
        ],
      });
      setTimeout(animateIn, 10);
    },
    [],
  );

  const handlePress = (btn: AlertButton) => {
    dismiss();
    if (btn.onPress) {
      setTimeout(btn.onPress, 200);
    }
  };

  const getIcon = () => {
    const size = 32;
    switch (alert.type) {
      case 'error':
        return <AlertCircle size={size} color={Colors.danger} />;
      case 'warning':
        return <AlertTriangle size={size} color="#F59E0B" />;
      case 'success':
        return <CheckCircle size={size} color="#10B981" />;
      case 'confirm':
        return <AlertTriangle size={size} color={Colors.primary} />;
      default:
        return <Info size={size} color={Colors.info} />;
    }
  };

  const getAccentColor = () => {
    switch (alert.type) {
      case 'error':
        return Colors.danger;
      case 'warning':
        return '#F59E0B';
      case 'success':
        return '#10B981';
      case 'confirm':
        return Colors.primary;
      default:
        return Colors.info;
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Modal transparent visible={alert.visible} animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Animated.View
            style={[
              styles.container,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Accent bar */}
            <View style={[styles.accentBar, { backgroundColor: getAccentColor() }]} />

            <View style={styles.body}>
              <View style={styles.iconRow}>{getIcon()}</View>
              <Text style={styles.title}>{alert.title}</Text>
              <Text style={styles.message}>{alert.message}</Text>

              <View style={styles.btnRow}>
                {alert.buttons.map((btn, i) => {
                  const isDestructive = btn.style === 'destructive';
                  const isCancel = btn.style === 'cancel';
                  return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.7}
                      style={[
                        styles.btn,
                        isCancel && styles.btnCancel,
                        isDestructive && [styles.btnDestructive, { backgroundColor: getAccentColor() }],
                        !isCancel && !isDestructive && [styles.btnDefault, { backgroundColor: getAccentColor() }],
                      ]}
                      onPress={() => handlePress(btn)}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          isCancel && styles.btnCancelText,
                          (isDestructive || (!isCancel && !isDestructive)) && styles.btnActionText,
                        ]}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  body: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.heading,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  message: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnDestructive: {},
  btnDefault: {},
  btnText: {
    fontSize: FontSize.body,
    fontWeight: '600',
  },
  btnCancelText: {
    color: Colors.text,
  },
  btnActionText: {
    color: '#fff',
  },
});
