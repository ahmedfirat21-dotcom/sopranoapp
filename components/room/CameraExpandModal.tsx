import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, W } from './constants';

// Safe lazy VideoView
let _VideoViewComponent: any = null;
try { _VideoViewComponent = require('@livekit/react-native').VideoView; } catch(e) {}
const VideoView = _VideoViewComponent || (({ style }: any) => <View style={style}><Text style={{color:'#fff',fontSize:10,textAlign:'center'}}>📷</Text></View>);

export default function CameraExpandModal({ nick, onClose, videoTrack }: { nick: string; onClose: () => void; videoTrack?: any }) {
  return (
    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 300 }}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={{ width: W * 0.85, height: W * 0.85, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(92,225,230,0.3)' }}>
        {videoTrack ? (
          <VideoView videoTrack={videoTrack} style={{ flex: 1 }} objectFit="cover" />
        ) : (
          <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="videocam" size={48} color="rgba(92,225,230,0.5)" />
            <Text style={{ color: COLORS.primary, fontSize: 16, fontWeight: '600', marginTop: 12 }}>{nick}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>🔴 CANLI</Text>
          </LinearGradient>
        )}
      </View>
      <TouchableOpacity onPress={onClose} style={{ marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
}
