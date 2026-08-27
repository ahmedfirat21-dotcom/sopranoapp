import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Returns only the part of the IME that actually overlaps the React Native window.
 *
 * Android can either resize the window or leave it full-height (notably with the
 * API 36 edge-to-edge requirement). Subtracting the observed window shrink from
 * the reported keyboard height makes the result correct in both modes and avoids
 * both the "composer behind keyboard" and the double-lift bugs.
 */
export function useKeyboardOverlap() {
  const initialWindowHeight = Dimensions.get('window').height;
  const closedWindowHeightRef = useRef(initialWindowHeight);
  const [windowHeight, setWindowHeight] = useState(initialWindowHeight);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardVisibleRef = useRef(false);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
      setKeyboardHeight(Math.max(0, event.endCoordinates?.height || 0));
      setWindowHeight(Dimensions.get('window').height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setWindowHeight(Dimensions.get('window').height);

      // Samsung devices can restore window metrics one or two frames after
      // keyboardDidHide. Capture the settled height for the next keyboard open.
      restoreTimerRef.current = setTimeout(() => {
        const restoredHeight = Dimensions.get('window').height;
        closedWindowHeightRef.current = restoredHeight;
        setWindowHeight(restoredHeight);
      }, Platform.OS === 'android' ? 80 : 0);
    });

    const dimensionsSub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowHeight(window.height);
      if (!keyboardVisibleRef.current) {
        closedWindowHeightRef.current = window.height;
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      dimensionsSub.remove();
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    };
  }, []);

  const keyboardOverlap = useMemo(() => {
    if (!keyboardVisible || keyboardHeight <= 0) return 0;
    if (Platform.OS !== 'android') return keyboardHeight;

    const windowShrink = Math.max(0, closedWindowHeightRef.current - windowHeight);
    return Math.max(0, keyboardHeight - windowShrink);
  }, [keyboardHeight, keyboardVisible, windowHeight]);

  return { keyboardHeight, keyboardOverlap, keyboardVisible, windowHeight };
}
