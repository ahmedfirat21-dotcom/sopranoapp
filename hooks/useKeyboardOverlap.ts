import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Shared keyboard geometry.
 *
 * `keyboardOverlap` is kept for old callers. Absolute overlays should prefer
 * `keyboardTopScreenY` + a measured host frame; Android 16/Samsung can report
 * a resized window while an absolute RN overlay still occupies the full screen.
 */
export function useKeyboardOverlap() {
  const initialWindowHeight = Dimensions.get('window').height;
  const closedWindowHeightRef = useRef(initialWindowHeight);
  const [windowHeight, setWindowHeight] = useState(initialWindowHeight);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardTopScreenY, setKeyboardTopScreenY] = useState<number | null>(null);
  const keyboardVisibleRef = useRef(false);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
      const reportedHeight = Math.max(0, event.endCoordinates?.height || 0);
      const reportedTop = event.endCoordinates?.screenY;
      const fallbackTop = Dimensions.get('screen').height - reportedHeight;

      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
      setKeyboardHeight(reportedHeight);
      setKeyboardTopScreenY(
        typeof reportedTop === 'number' && Number.isFinite(reportedTop) && reportedTop > 0
          ? reportedTop
          : fallbackTop,
      );
      setWindowHeight(Dimensions.get('window').height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setKeyboardTopScreenY(null);
      setWindowHeight(Dimensions.get('window').height);

      // Samsung can restore dimensions one or two frames after keyboardDidHide.
      restoreTimerRef.current = setTimeout(() => {
        const restoredHeight = Dimensions.get('window').height;
        closedWindowHeightRef.current = restoredHeight;
        setWindowHeight(restoredHeight);
      }, Platform.OS === 'android' ? 80 : 0);
    });

    const dimensionsSub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowHeight(window.height);
      if (!keyboardVisibleRef.current) closedWindowHeightRef.current = window.height;
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

  return {
    keyboardHeight,
    keyboardOverlap,
    keyboardVisible,
    keyboardTopScreenY,
    windowHeight,
  };
}
