import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarSource } from '../../constants/avatars';
import { COLORS, W } from './constants';

export default function AudienceDrawer({ users, onClose, onSelectUser }: { users: any[]; onClose: () => void; onSelectUser: (u: any) => void }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: W * 0.72, backgroundColor: 'rgba(8,12,24,0.97)', zIndex: 250, borderRightWidth: 1, borderRightColor: 'rgba(92,225,230,0.15)', paddingTop: 60 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: COLORS.primary, fontSize: 15, fontWeight: '700' }}>👥 Tüm Dinleyiciler ({users.length})</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {users.map((u) => {
          const initials = (u.user?.display_name || 'M').slice(0, 2).toUpperCase();
          return (
            <TouchableOpacity key={u.id} onPress={() => onSelectUser(u)} activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, marginBottom: 2, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(92,225,230,0.08)', borderWidth: 1, borderColor: 'rgba(92,225,230,0.15)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {u.user?.avatar_url ? (
                  <Image source={getAvatarSource(u.user.avatar_url)} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
                ) : (
                  <Text style={{ color: COLORS.silverDark, fontSize: 12, fontWeight: '700' }}>{initials}</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{u.user?.display_name || 'Misafir'}</Text>
                <Text style={{ color: COLORS.silverDark, fontSize: 10, marginTop: 1 }}>Dinleyici</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(92,225,230,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person-add-outline" size={13} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="chatbubble-outline" size={13} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
