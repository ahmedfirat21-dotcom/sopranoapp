/**
 * SopranoChat — Kişisel not card
 * v110.5 (6 May 2026)
 *
 * Discord stili "kişisel not" — sadece sahibi görür. Profilde "yapışkan not"
 * görünümünde, tıklayınca inline edit'e geçer (TextInput).
 *
 * Kayıtlı not yoksa "+ Not ekle" CTA gösterir (sadece kendin için).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from '../../constants/theme';
import { UserNotesService, MAX_NOTE_LENGTH } from '../../services/profileExtras';
import { showToast } from '../Toast';
import { i18n } from '../../services/i18n';

type Props = {
  ownerId: string;
  targetId: string;
  initialNote: string | null;
};

export default function PersonalNoteCard({ ownerId, targetId, initialNote }: Props) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote || '');
  const [draft, setDraft] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);

  // initialNote prop değişirse senkronla (target user değiştiyse)
  useEffect(() => {
    setNote(initialNote || '');
    setDraft(initialNote || '');
    setEditing(false);
  }, [initialNote, targetId]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed === note) {
      // Değişiklik yok
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await UserNotesService.upsert(ownerId, targetId, trimmed);
      setNote(trimmed);
      setEditing(false);
      Keyboard.dismiss();
      if (trimmed) showToast({ title: 'Not kaydedildi', type: 'success' });
    } catch {
      showToast({ title: 'Not kaydedilemedi', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(note);
    setEditing(false);
    Keyboard.dismiss();
  };

  const startEdit = () => {
    setDraft(note);
    setEditing(true);
  };

  // Hiç not yok ve edit modda değil → küçük ekle CTA
  if (!note && !editing) {
    return (
      <Pressable
        onPress={startEdit}
        style={({ pressed }) => [s.emptyWrap, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="bookmark-outline" size={13} color="rgba(148,163,184,0.7)" />
        <Text style={s.emptyText}>{i18n.t('profile.note_placeholder')}</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Ionicons name="bookmark" size={12} color="#FBBF24" />
        <Text style={s.headerText}>{i18n.t('profile.your_note')}</Text>
        <View style={{ flex: 1 }} />
        {!editing && (
          <Pressable onPress={startEdit} hitSlop={6} style={s.editIcon}>
            <Ionicons name="pencil" size={12} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {editing ? (
        <>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            autoFocus
            maxLength={MAX_NOTE_LENGTH}
            placeholder="Bu kişi hakkında özel not bırak (sadece sen görürsün)"
            placeholderTextColor="rgba(148,163,184,0.5)"
            style={s.input}
          />
          <View style={s.editActions}>
            <Text style={s.charCount}>{draft.length}/{MAX_NOTE_LENGTH}</Text>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [s.btnGhost, pressed && { opacity: 0.7 }]}
              hitSlop={6}
              disabled={saving}
            >
              <Text style={s.btnGhostText}>{i18n.t('profile.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [s.btnSave, (pressed || saving) && { opacity: 0.7 }]}
              hitSlop={6}
            >
              <Text style={s.btnSaveText}>{saving ? '...' : 'Kaydet'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable onPress={startEdit}>
          <Text style={s.noteText}>{note}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  emptyWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed' as const,
    alignSelf: 'flex-start' as const,
  },
  emptyText: {
    fontSize: 11, color: 'rgba(148,163,184,0.85)', fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  wrap: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.20)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 6,
  },
  headerText: {
    fontSize: 9, fontWeight: '900' as const, color: '#FBBF24',
    letterSpacing: 1.2, ...Shadows.text,
  },
  editIcon: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  noteText: {
    fontSize: 12, color: '#FDE68A', lineHeight: 17,
    fontStyle: 'italic',
  },
  input: {
    fontSize: 12, color: '#FEF3C7',
    minHeight: 60, maxHeight: 100,
    padding: 0, marginBottom: 8,
    textAlignVertical: 'top' as const,
  },
  editActions: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  charCount: {
    fontSize: 10, color: '#94A3B8', fontWeight: '600' as const,
  },
  btnGhost: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
  },
  btnGhostText: {
    fontSize: 11, color: '#94A3B8', fontWeight: '700' as const,
  },
  btnSave: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FBBF24',
  },
  btnSaveText: {
    fontSize: 11, color: '#1F2937', fontWeight: '900' as const,
    letterSpacing: 0.3,
  },
});
