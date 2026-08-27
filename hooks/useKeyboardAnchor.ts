import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { useKeyboardOverlap } from './useKeyboardOverlap';

type HostFrame = { y: number; height: number };

/**
 * Anchors a composer/sheet to the real IME top using screen measurements.
 *
 * If Android really resized the host, the host already ends at the keyboard and
 * the inset becomes 0. If the host remains full-screen behind the IME, the inset
 * is exactly the covered portion. This avoids both double-lift and hidden input.
 */
export function useKeyboardAnchor() {
  const keyboard = useKeyboardOverlap();
  const hostRef = useRef<View>(null);
  const keyboardVisibleRef = useRef(keyboard.keyboardVisible);
  keyboardVisibleRef.current = keyboard.keyboardVisible;
  const closedHostBottomRef = useRef(Dimensions.get('window').height);
  const [hostFrame, setHostFrame] = useState<HostFrame>({
    y: 0,
    height: Dimensions.get('window').height,
  });

  const measureHost = useCallback(() => {
    requestAnimationFrame(() => {
      hostRef.current?.measureInWindow((_x, y, _w, height) => {
        if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return;
        if (!keyboardVisibleRef.current) closedHostBottomRef.current = y + height;
        setHostFrame((prev) =>
          Math.abs(prev.y - y) < 0.5 && Math.abs(prev.height - height) < 0.5
            ? prev
            : { y, height },
        );
      });
    });
  }, []);

  useEffect(() => {
    measureHost();
    const fast = setTimeout(measureHost, Platform.OS === 'android' ? 32 : 16);
    const settled = setTimeout(measureHost, Platform.OS === 'android' ? 140 : 80);
    return () => {
      clearTimeout(fast);
      clearTimeout(settled);
    };
  }, [keyboard.keyboardVisible, keyboard.keyboardTopScreenY, keyboard.windowHeight, measureHost]);

  const keyboardInset = useMemo(() => {
    if (!keyboard.keyboardVisible) return 0;
    const hostBottomScreenY = hostFrame.y + hostFrame.height;
    const measuredCover = keyboard.keyboardTopScreenY == null
      ? 0
      : Math.max(0, hostBottomScreenY - keyboard.keyboardTopScreenY);

    // Android 15/16 edge-to-edge builds (notably Samsung One UI) can report both
    // a resized global window and an unusable screenY while an absolute overlay
    // itself did not resize. Compare the overlay's own closed/open bottom edge:
    // - host really shrank by IME height => inset 0 (already above keyboard)
    // - host stayed full-screen         => inset full keyboard height
    // This avoids both the Samsung zero-inset failure and double lifting.
    const hostShrink = Math.max(0, closedHostBottomRef.current - hostBottomScreenY);
    const fallbackCover = Math.max(0, keyboard.keyboardHeight - hostShrink);
    return Math.min(hostFrame.height, Math.max(measuredCover, fallbackCover));
  }, [keyboard.keyboardVisible, keyboard.keyboardTopScreenY, keyboard.keyboardHeight, hostFrame]);

  return {
    ...keyboard,
    hostRef,
    onHostLayout: measureHost,
    hostTopScreenY: hostFrame.y,
    hostHeight: hostFrame.height,
    keyboardInset,
  };
}
