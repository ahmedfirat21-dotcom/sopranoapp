import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import GiftAnimation, { GiftAnimationProps } from './GiftAnimation';

export interface QueuedGift extends Omit<GiftAnimationProps, 'visible' | 'onComplete'> {
  id: string; // Unique queue ID
}

export interface GiftAnimationQueueProps {
  gifts: QueuedGift[];
  onGiftComplete: (id: string) => void;
}

export default function GiftAnimationQueue({ gifts, onGiftComplete }: GiftAnimationQueueProps) {
  const [currentGift, setCurrentGift] = useState<QueuedGift | null>(null);

  useEffect(() => {
    // Eger su an islenen bir hediye yoksa ve sirada hediye varsa, ilkini isleme al
    if (!currentGift && gifts.length > 0) {
      setCurrentGift(gifts[0]);
    }
  }, [gifts, currentGift]);

  const handleComplete = () => {
    if (currentGift) {
      onGiftComplete(currentGift.id);
      setCurrentGift(null); // Sonrakini useEffect tetikleyecek
    }
  };

  if (!currentGift && gifts.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]} pointerEvents="none">
      {/* Siradaki hediye */}
      {currentGift && (
        <GiftAnimation
          key={currentGift.id}
          giftId={currentGift.giftId}
          senderName={currentGift.senderName}
          targetName={(currentGift as any).targetName}
          giftName={currentGift.giftName}
          tier={currentGift.tier}
          visible={true}
          onComplete={handleComplete}
        />
      )}
      
      {/* Ekranda bekleyen hediye sayisi (istege bagli eklenti, yogun yayinlarda gosterilebilir) */}
      {gifts.length > 1 && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>+{gifts.length - 1} Hediye Sırada</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  }
});
