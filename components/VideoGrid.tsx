import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import type { Participant } from 'livekit-client';
import VideoTile from './VideoTile';
import { Colors } from '../constants/theme';
import { type ParticipantUpdate } from '../services/livekit';
import { type RoomParticipant } from '../services/database';

interface VideoGridProps {
  videoParticipants: Participant[];
  screenShareParticipant: Participant | null;
  voiceUpdates: ParticipantUpdate[];
  roomParticipants: RoomParticipant[];
  hostId?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toplam margin ve padding'i çıkartarak alanı bul (Sağ/sol 20 padding var)
const AVAIL_WIDTH = SCREEN_WIDTH - 40;

export default function VideoGrid({ videoParticipants, screenShareParticipant, voiceUpdates, roomParticipants, hostId }: VideoGridProps) {
  // DB üzerinden katılımcı bilgilerini çekme yardımcısı
  const getDbUser = (identity: string) => roomParticipants.find(p => p.user_id === identity);
  const getVoiceUpdate = (identity: string) => voiceUpdates.find(u => u.identity === identity);

  // 1: Ekran Paylaşımı Var mı?
  if (screenShareParticipant) {
    const dbUser = getDbUser(screenShareParticipant.identity);
    return (
      <View style={styles.container}>
        {/* %70 Ekran Paylaşımı */}
        <VideoTile 
          participant={screenShareParticipant}
          participantUpdate={getVoiceUpdate(screenShareParticipant.identity)}
          displayName={dbUser?.user?.display_name || 'Kullanıcı'}
          avatarUrl={dbUser?.user?.avatar_url}
          isHost={dbUser?.role === 'host'}
          isScreenShare={true}
          style={styles.mainScreenShare}
        />
        {/* Thumbnail Videolar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailScroll}>
          {videoParticipants.map(vp => {
            const vpDbUser = getDbUser(vp.identity);
            return (
              <VideoTile
                key={vp.identity}
                participant={vp}
                participantUpdate={getVoiceUpdate(vp.identity)}
                displayName={vpDbUser?.user?.display_name || 'User'}
                avatarUrl={vpDbUser?.user?.avatar_url}
                isHost={vpDbUser?.role === 'host'}
                style={styles.thumbnailTile}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // 2: Sadece Videolar. Dinamik flex düzeni.
  const count = videoParticipants.length;

  if (count === 1) {
    // Tek Video
    const vp = videoParticipants[0];
    const vpDbUser = getDbUser(vp.identity);
    return (
      <View style={styles.container}>
        <VideoTile
          participant={vp}
          participantUpdate={getVoiceUpdate(vp.identity)}
          displayName={vpDbUser?.user?.display_name || 'Kullanıcı'}
          avatarUrl={vpDbUser?.user?.avatar_url}
          isHost={vpDbUser?.role === 'host'}
          style={styles.singleTile}
        />
      </View>
    );
  }

  if (count === 2) {
    // Yan yana 2 Video (ya da alt alta)
    return (
      <View style={[styles.container, styles.flexRow]}>
        {videoParticipants.map(vp => {
          const vpDbUser = getDbUser(vp.identity);
          return (
             <VideoTile
              key={vp.identity}
              participant={vp}
              participantUpdate={getVoiceUpdate(vp.identity)}
              displayName={vpDbUser?.user?.display_name || 'U'}
              avatarUrl={vpDbUser?.user?.avatar_url}
              style={[styles.tile, { height: '100%', width: (AVAIL_WIDTH - 10) / 2 }]}
            />
          );
        })}
      </View>
    );
  }

  if (count <= 4) {
    // 2x2 Grid
    return (
      <View style={[styles.container, styles.flexWrap]}>
        {videoParticipants.map(vp => {
          const vpDbUser = getDbUser(vp.identity);
          return (
             <VideoTile
              key={vp.identity}
              participant={vp}
              participantUpdate={getVoiceUpdate(vp.identity)}
              displayName={vpDbUser?.user?.display_name || 'U'}
              avatarUrl={vpDbUser?.user?.avatar_url}
              style={[styles.tile, { height: '48%', width: (AVAIL_WIDTH - 10) / 2 }]}
            />
          );
        })}
      </View>
    );
  }

  if (count <= 6) {
    // 2x3 Grid
    return (
      <View style={[styles.container, styles.flexWrap]}>
        {videoParticipants.map(vp => {
          const vpDbUser = getDbUser(vp.identity);
          return (
             <VideoTile
              key={vp.identity}
              participant={vp}
              participantUpdate={getVoiceUpdate(vp.identity)}
              displayName={vpDbUser?.user?.display_name || 'U'}
              avatarUrl={vpDbUser?.user?.avatar_url}
              style={[styles.tile, { height: '31%', width: (AVAIL_WIDTH - 10) / 2 }]}
            />
          );
        })}
      </View>
    );
  }

  // 6'dan fazla ise kaydırılabilir flex
  return (
    <ScrollView style={styles.container}>
      <View style={styles.flexWrap}>
        {videoParticipants.map(vp => {
          const vpDbUser = getDbUser(vp.identity);
          return (
             <VideoTile
              key={vp.identity}
              participant={vp}
              participantUpdate={getVoiceUpdate(vp.identity)}
              displayName={vpDbUser?.user?.display_name || 'U'}
              avatarUrl={vpDbUser?.user?.avatar_url}
              style={[styles.tile, { height: 160, width: (AVAIL_WIDTH - 10) / 2, marginBottom: 10 }]}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 380, // Temel grid alanı
    backgroundColor: 'transparent',
  },
  flexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    height: '100%',
  },
  singleTile: {
    width: '100%',
    height: '100%',
  },
  tile: {
    // Inline flex hesaplamaları
  },
  mainScreenShare: {
    width: '100%',
    height: 280, // Ekran paylaşımı için büyük alan
    marginBottom: 10,
  },
  thumbnailScroll: {
    flexDirection: 'row',
    width: '100%',
  },
  thumbnailTile: {
    width: 100,
    height: 90,
    marginRight: 10,
  }
});
