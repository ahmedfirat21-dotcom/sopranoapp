from pathlib import Path
import json
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# 1) Keyboard geometry: keep legacy overlap for existing callers, but expose
#    absolute IME top in screen coordinates for measured overlays.
# -----------------------------------------------------------------------------
Path("hooks/useKeyboardOverlap.ts").write_text(
    """import { useEffect, useMemo, useRef, useState } from 'react';
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
""",
    encoding="utf-8",
)

Path("hooks/useKeyboardAnchor.ts").write_text(
    """import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
""",
    encoding="utf-8",
)


# -----------------------------------------------------------------------------
# 2) Room chat sheet: measured IME anchor + measured room control-bar clearance.
# -----------------------------------------------------------------------------
p = Path("components/room/RoomChatDrawer.tsx")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    "import { useKeyboardOverlap } from '../../hooks/useKeyboardOverlap';",
    "import { useKeyboardAnchor } from '../../hooks/useKeyboardAnchor';",
    "RoomChatDrawer keyboard import",
)
s = replace_once(
    s,
    "  bottomInset: number;\n",
    "  bottomInset: number;\n  /** Actual RoomControlBar wrapper height (bar + device safe-area). */\n  bottomClearance?: number;\n",
    "RoomChatDrawer bottomClearance prop",
)
s = replace_once(
    s,
    "  visible, messages, chatInput, onChangeInput, onSend, onClose, onSendRaw, currentUserId, roomId, onAvatarPress,\n",
    "  visible, messages, chatInput, onChangeInput, onSend, onClose, bottomInset, bottomClearance = 0, onSendRaw, currentUserId, roomId, onAvatarPress,\n",
    "RoomChatDrawer destructuring",
)

start = s.index("  const screenH = Dimensions.get('screen').height;\n")
end = s.index("  // ★ Ref'ler — PanResponder stale closure bug'ını önler\n", start)
replacement = """  const {
    hostRef: keyboardHostRef,
    onHostLayout: onKeyboardHostLayout,
    keyboardInset,
    keyboardVisible,
    hostHeight,
  } = useKeyboardAnchor();

  // Closed keyboard: sit exactly above the real room control bar.
  // Open keyboard: use the physically measured IME overlap of this overlay host.
  const fallbackRestBottom = CONTROL_BAR_AREA + Math.max(bottomInset || insets.bottom, 7);
  const restBottom = Math.max(bottomClearance || 0, fallbackRestBottom);
  const layoutHeight = Math.max(hostHeight, 320);
  const anchorBottom = keyboardVisible ? keyboardInset : restBottom;
  const availableH = Math.max(240, layoutHeight - anchorBottom - Math.max(insets.top, 20));
  const SNAP_CLOSED = 0;
  const SNAP_HALF = Math.min(availableH * 0.62, layoutHeight * 0.50);
  const SNAP_FULL = Math.min(availableH * 0.80, layoutHeight * 0.65);

  const GLOW_BANNER_H = 38;
  const INPUT_BAR_BASE_H = 54;
  const INPUT_BAR_H = pendingGlowStyle ? INPUT_BAR_BASE_H + GLOW_BANNER_H : INPUT_BAR_BASE_H;

  const sheetHeight = useRef(new Animated.Value(0)).current;
  const closeTranslateY = useRef(new Animated.Value(0)).current;
  const inputBarH = useRef(new Animated.Value(INPUT_BAR_H)).current;
  const currentSnap = useRef(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const lastOpenSnapRef = useRef(SNAP_HALF);
  const inputBottomAnim = useRef(new Animated.Value(restBottom)).current;
  const sheetBottomAnim = useRef(new Animated.Value(restBottom)).current;

  useEffect(() => {
    if (!visible) return;
    inputBottomAnim.setValue(keyboardVisible ? keyboardInset : restBottom);
    sheetBottomAnim.setValue(keyboardVisible ? keyboardInset : restBottom);
  }, [visible, keyboardVisible, keyboardInset, restBottom, inputBottomAnim, sheetBottomAnim]);

  useEffect(() => {
    if (!visible) return;
    const targetBottom = keyboardVisible ? keyboardInset : restBottom;

    Animated.timing(sheetBottomAnim, {
      toValue: targetBottom,
      duration: keyboardVisible ? 120 : 170,
      useNativeDriver: false,
    }).start();

    if (keyboardVisible) {
      const topReserve = Math.max(insets.top + 60, 100);
      const visibleArea = Math.max(240, layoutHeight - targetBottom - topReserve - INPUT_BAR_H);
      if (currentSnap.current > visibleArea) {
        currentSnap.current = visibleArea;
        Animated.timing(sheetHeight, {
          toValue: visibleArea,
          duration: 140,
          useNativeDriver: false,
        }).start();
      }
    } else if (currentSnap.current > 0) {
      const restoredHeight = Math.min(lastOpenSnapRef.current, availableH);
      currentSnap.current = restoredHeight;
      Animated.timing(sheetHeight, {
        toValue: restoredHeight,
        duration: 170,
        useNativeDriver: false,
      }).start();
    }
  }, [
    visible, keyboardVisible, keyboardInset, restBottom, layoutHeight,
    INPUT_BAR_H, insets.top, availableH, sheetBottomAnim, sheetHeight,
  ]);

"""
s = s[:start] + replacement + s[end:]

s = replace_once(
    s,
    "  return (\n    <>\n      {/* Backdrop — hafif karartma, tıklayınca kapat */}",
    "  return (\n    <View\n      ref={keyboardHostRef}\n      collapsable={false}\n      onLayout={onKeyboardHostLayout}\n      style={StyleSheet.absoluteFill}\n      pointerEvents=\"box-none\"\n    >\n      {/* Backdrop — hafif karartma, tıklayınca kapat */}",
    "RoomChatDrawer measuring host open",
)
s = replace_once(
    s,
    "      />\n    </>\n  );\n}\n\n// ═══════════════════════════════════════════════════\n// STYLES",
    "      />\n    </View>\n  );\n}\n\n// ═══════════════════════════════════════════════════\n// STYLES",
    "RoomChatDrawer measuring host close",
)
p.write_text(s, encoding="utf-8")


# -----------------------------------------------------------------------------
# 3) Room screen embedded DM: same measured IME anchor + real control-bar height.
# -----------------------------------------------------------------------------
p = Path("app/room/[id].tsx")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    "import { useKeyboardOverlap } from '../../hooks/useKeyboardOverlap';",
    "import { useKeyboardAnchor } from '../../hooks/useKeyboardAnchor';",
    "room keyboard import",
)
s = replace_once(
    s,
    "function DmPanelDrawer({ visible, onClose, dmInboxMessages, setDmInboxMessages, dmUnreadCount, firebaseUser, bottomInset, initialChatTarget }: {",
    "function DmPanelDrawer({ visible, onClose, dmInboxMessages, setDmInboxMessages, dmUnreadCount, firebaseUser, bottomInset, bottomClearance, initialChatTarget }: {",
    "DM signature",
)
s = replace_once(
    s,
    "  bottomInset: number;\n  initialChatTarget?:",
    "  bottomInset: number;\n  bottomClearance?: number;\n  initialChatTarget?:",
    "DM type",
)

dm_start = s.index("  // API 36 edge-to-edge: IME pencereyi bazı cihazlarda küçültür, bazılarında örter.\n")
dm_end = s.index("  // ★ Swipe-to-dismiss — sağa sürükle\n", dm_start)
dm_replacement = """  const {
    hostRef: dmKeyboardHostRef,
    onHostLayout: onDmKeyboardHostLayout,
    keyboardInset: dmKeyboardInset,
    keyboardVisible: dmKeyboardVisible,
    hostHeight: dmHostHeight,
  } = useKeyboardAnchor();

  // Keyboard closed: clear the actual measured RoomControlBar wrapper.
  // Keyboard open: the control bar is moved behind IME; anchor directly to IME top.
  const FALLBACK_CONTROL_CLEARANCE = 72 + Math.max(bottomInset, 6);
  const REST_BOTTOM = Math.max(bottomClearance || 0, FALLBACK_CONTROL_CLEARANCE);
  const REST_TOP = 70;
  const restHeight = Math.max(dmHostHeight - REST_BOTTOM - REST_TOP, 240);
  const dmPanelBottomAnim = useRef(new Animated.Value(REST_BOTTOM)).current;
  const dmPanelHeightAnim = useRef(new Animated.Value(restHeight)).current;

  useEffect(() => {
    const composerActive = dmKeyboardVisible && !!chatTarget;
    const targetBottom = composerActive ? dmKeyboardInset : REST_BOTTOM;
    const targetHeight = Math.max(dmHostHeight - targetBottom - REST_TOP, 240);

    Animated.parallel([
      Animated.timing(dmPanelBottomAnim, {
        toValue: targetBottom,
        duration: composerActive ? 120 : 170,
        useNativeDriver: false,
      }),
      Animated.timing(dmPanelHeightAnim, {
        toValue: targetHeight,
        duration: composerActive ? 120 : 170,
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    chatTarget?.userId, dmKeyboardVisible, dmKeyboardInset, dmHostHeight,
    REST_BOTTOM, REST_TOP, dmPanelBottomAnim, dmPanelHeightAnim,
  ]);

"""
s = s[:dm_start] + dm_replacement + s[dm_end:]

s = replace_once(
    s,
    "    <View style={StyleSheet.absoluteFill} pointerEvents=\"box-none\">\n      {/* Backdrop */}",
    "    <View\n      ref={dmKeyboardHostRef}\n      collapsable={false}\n      onLayout={onDmKeyboardHostLayout}\n      style={StyleSheet.absoluteFill}\n      pointerEvents=\"box-none\"\n    >\n      {/* Backdrop */}",
    "DM measuring host",
)

s = replace_once(
    s,
    "  // ★ v107: Hediye paneli — kontrol barındaki 🎁 butonu açar\n",
    "  // Overlay clearances use the real rendered control-bar wrapper height.\n  const [controlBarClearance, setControlBarClearance] = useState(72 + Math.max(insets.bottom, 6));\n  useEffect(() => {\n    setControlBarClearance(72 + Math.max(insets.bottom, 6));\n  }, [insets.bottom]);\n\n  // ★ v107: Hediye paneli — kontrol barındaki 🎁 butonu açar\n",
    "control bar clearance state",
)

s = replace_once(
    s,
    "      <View style={{ position: 'absolute', bottom: ctrlKbOffsetPx, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 6), zIndex: 200, elevation: 200 }}>",
    "      <View\n        onLayout={(e) => {\n          const h = e.nativeEvent.layout.height;\n          if (h > 0 && Math.abs(h - controlBarClearance) > 0.5) setControlBarClearance(h);\n        }}\n        style={{ position: 'absolute', bottom: ctrlKbOffsetPx, left: 0, right: 0, paddingBottom: Math.max(insets.bottom, 6), zIndex: 200, elevation: 200 }}\n      >",
    "control bar measurement",
)

s = replace_once(
    s,
    "        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom}\n",
    "        onChangeInput={setChatInput} onSend={handleSendChat} onClose={() => setShowChatDrawer(false)} bottomInset={insets.bottom}\n        bottomClearance={controlBarClearance}\n",
    "RoomChatDrawer clearance pass",
)
s = replace_once(
    s,
    "        bottomInset={insets.bottom}\n        initialChatTarget={dmInitialTarget}\n",
    "        bottomInset={insets.bottom}\n        bottomClearance={controlBarClearance}\n        initialChatTarget={dmInitialTarget}\n",
    "DM clearance pass",
)
p.write_text(s, encoding="utf-8")


# -----------------------------------------------------------------------------
# 4) Full-screen DM: same measured host/IME anchor.
# -----------------------------------------------------------------------------
p = Path("app/chat/[id].tsx")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    "import { useKeyboardOverlap } from '../../hooks/useKeyboardOverlap';",
    "import { useKeyboardAnchor } from '../../hooks/useKeyboardAnchor';",
    "chat keyboard import",
)
s = replace_once(
    s,
    "  const { keyboardOverlap: kbHeight, keyboardVisible } = useKeyboardOverlap();",
    "  const {\n    hostRef: keyboardHostRef,\n    onHostLayout: onKeyboardHostLayout,\n    keyboardInset: kbHeight,\n    keyboardVisible,\n  } = useKeyboardAnchor();",
    "chat keyboard hook",
)
s = replace_once(
    s,
    "    <AppBackground radialGlow>\n    {/* API 36 edge-to-edge: gerçek IME örtüşmesi kadar padding uygulanır. */}\n    <Animated.View style={[styles.container, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }], paddingBottom: kbHeight }]}>",
    "    <AppBackground radialGlow>\n    <View\n      ref={keyboardHostRef}\n      collapsable={false}\n      onLayout={onKeyboardHostLayout}\n      style={styles.keyboardHost}\n    >\n    {/* API 36/Samsung: measured host is anchored to the physical IME top. */}\n    <Animated.View style={[styles.container, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }], paddingBottom: kbHeight }] }>",
    "chat measuring host open",
)
s = replace_once(
    s,
    "    </Animated.View>\n    </AppBackground>\n  );",
    "    </Animated.View>\n    </View>\n    </AppBackground>\n  );",
    "chat measuring host close",
)
s = replace_once(
    s,
    "const styles = StyleSheet.create({\n  container: { flex: 1, backgroundColor: 'transparent' },\n",
    "const styles = StyleSheet.create({\n  keyboardHost: { flex: 1 },\n  container: { flex: 1, backgroundColor: 'transparent' },\n",
    "chat measuring host style",
)
p.write_text(s, encoding="utf-8")


# -----------------------------------------------------------------------------
# 5) Release candidate bump.
# -----------------------------------------------------------------------------
app = Path("app.json")
data = json.loads(app.read_text(encoding="utf-8"))
data["expo"]["version"] = "1.7.13.157"
data["expo"]["android"]["versionCode"] = 384
app.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

p = Path("android/app/build.gradle")
s = p.read_text(encoding="utf-8")
s, c1 = re.subn(r"versionCode\s+383\b", "versionCode 384", s, count=1)
s, c2 = re.subn(r"versionName\s+\"1\.7\.13\.156\"", 'versionName "1.7.13.157"', s, count=1)
if c1 != 1 or c2 != 1:
    raise SystemExit(f"Android version bump failed: versionCode={c1}, versionName={c2}")
p.write_text(s, encoding="utf-8")

p = Path(".github/workflows/build-livekit-current-ui.yml")
s = p.read_text(encoding="utf-8")
s = replace_once(
    s,
    "sopranochat-1.7.13.156-keyboard-and-lobby-apk-aab",
    "sopranochat-1.7.13.157-keyboard-root-fix-apk-aab",
    "artifact version",
)
p.write_text(s, encoding="utf-8")

# Guardrails: old failed geometry must be gone from affected in-room surfaces.
room = Path("app/room/[id].tsx").read_text(encoding="utf-8")
drawer = Path("components/room/RoomChatDrawer.tsx").read_text(encoding="utf-8")
chat = Path("app/chat/[id].tsx").read_text(encoding="utf-8")
assert "const { keyboardOverlap, keyboardVisible, windowHeight } = useKeyboardOverlap();" not in room
assert "const [kbCompensation, setKbCompensation]" not in drawer
assert "bottomClearance={controlBarClearance}" in room
assert "useKeyboardAnchor" in room and "useKeyboardAnchor" in drawer and "useKeyboardAnchor" in chat
print("keyboard overlay root patch applied successfully")
