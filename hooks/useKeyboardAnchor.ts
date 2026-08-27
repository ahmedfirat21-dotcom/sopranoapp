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
  const [hostFrame, setHostFrame] = useState<HostFrame>({
    y: 0,
    height: Dimensions.get('window').height,
  });

  const measureHost = useCallback(() => {
    requestAnimationFrame(() => {
      hostRef.current?.measureInWindow((_x, y, _w, height) => {
        if (!Number.isFinite(y) || !Number.isFinite(height) || height <= 0) return;
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
    if (!keyboard.keyboardVisible || keyboard.keyboardTopScreenY == null) return 0;
    const hostBottomScreenY = hostFrame.y + hostFrame.height;
    const covered = Math.max(0, hostBottomScreenY - keyboard.keyboardTopScreenY);
    return Math.min(hostFrame.height, covered);
  }, [keyboard.keyboardVisible, keyboard.keyboardTopScreenY, hostFrame]);

  return {
    ...keyboard,
    hostRef,
    onHostLayout: measureHost,
    hostTopScreenY: hostFrame.y,
    hostHeight: hostFrame.height,
    keyboardInset,
  };
}
