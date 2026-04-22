/**
 * SopranoChat — Emoji Drawer
 * Alt barın arkasından yukarı kayarak açılır, aşağı sürükleyerek kapatılır.
 * RoomChatDrawer ile aynı UX pattern.
 */
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder, Dimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { EmojiReactionBar } from '../EmojiReactions';

const { height: SCREEN_H } = Dimensions.get('window');
const PANEL_HEIGHT = 280;

interface Props {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  bottomInset: number;
}

export default function EmojiDrawer({ visible, onClose, onReaction, bottomInset }: Props) {
  const BAR_OFFSET = bottomInset + 56;
  const CLOSED_Y = PANEL_HEIGHT + BAR_OFFSET;

  const translateY = useRef(new Animated.Value(PANEL_HEIGHT + 200)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) translateY.setValue(CLOSED_Y);
  }, [CLOSED_Y, visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60 || gs.vy > 0.5) {
          Animated.timing(translateY, { toValue: CLOSED_Y, duration: 200, useNativeDriver: true }).start(() => {
            onClose();
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 48 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]} />
        </Pressable>
      </Animated.View>

      {/* Panel — control bar'ın ARKASINA kadar uzayan tek sürekli yüzey (RoomChatDrawer ile aynı pattern) */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.panel,
          {
            height: PANEL_HEIGHT + BAR_OFFSET,
            paddingBottom: BAR_OFFSET,
            transform: [{ translateY }],
          },
        ]}
      >
        <LinearGradient colors={['#4a5668', '#37414f', '#232a35']} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 20, borderTopRightRadius: 20 }]} />
        {/* Sürükleme tutamağı */}
        <View style={styles.handle}>
          <View style={styles.handleBar} />
        </View>

        {/* Emoji içeriği */}
        <EmojiReactionBar
          onReaction={(emoji: string) => {
            onReaction(emoji);
          }}
          onClose={onClose}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
