import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Global hook that tracks keyboard height.
 * Returns 0 when keyboard is hidden.
 * Works reliably on Android (keyboardDidShow/Hide) and iOS.
 */
export function useKeyboardHeight(): number {
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKbHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return kbHeight;
}
