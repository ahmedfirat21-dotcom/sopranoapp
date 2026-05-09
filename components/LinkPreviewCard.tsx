/**
 * SopranoChat — Link Preview Card (v109)
 * ═══════════════════════════════════════════════════════════════════
 * Mesaj içindeki ilk URL'den OG metadata fetch eder, küçük preview kart
 * render eder (title, description, image). 24 saatlik AsyncStorage cache.
 *
 * RN fetch CORS-bypass yapamaz; bazı siteler boş döner — graceful fallback.
 * Tam OG (og:type, og:video, twitter cards) post-launch'a edge function ile.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Linking, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const URL_RE = /(https?:\/\/[^\s<>"]+)/i;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site?: string;
}

function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0] : null;
}

function parseOG(html: string, fallbackUrl: string): LinkPreview {
  const get = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'") : undefined;
  };
  const title =
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<title>([^<]+)<\/title>/i);
  const description =
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  let image =
    get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  const site =
    get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
    (() => { try { return new URL(fallbackUrl).hostname.replace(/^www\./, ''); } catch { return undefined; } })();
  if (image && image.startsWith('//')) image = 'https:' + image;
  return { url: fallbackUrl, title, description, image, site };
}

async function getCached(url: string): Promise<LinkPreview | null> {
  try {
    const raw = await AsyncStorage.getItem(`lpc:${url}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.t > CACHE_TTL_MS) return null;
    return obj.data as LinkPreview;
  } catch { return null; }
}

async function setCached(url: string, data: LinkPreview) {
  try {
    await AsyncStorage.setItem(`lpc:${url}`, JSON.stringify({ t: Date.now(), data }));
  } catch {}
}

async function fetchPreview(url: string): Promise<LinkPreview | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(url, {
      signal: ctrl.signal as any,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SopranoChatBot/1.0)' },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    const html = await resp.text();
    return parseOG(html.slice(0, 200_000), url);
  } catch { return null; }
}

interface Props {
  text: string;
  isMe?: boolean;
}

export default function LinkPreviewCard({ text, isMe }: Props) {
  const url = extractFirstUrl(text);
  const [preview, setPreview] = useState<LinkPreview | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    (async () => {
      const cached = await getCached(url);
      if (!cancelled && cached) { setPreview(cached); return; }
      const fresh = await fetchPreview(url);
      if (cancelled) return;
      if (fresh && (fresh.title || fresh.image)) {
        setPreview(fresh);
        setCached(url, fresh);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (!url || !preview || (!preview.title && !preview.image)) return null;

  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={[s.card, isMe && s.cardMe]}
    >
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={s.image} resizeMode="cover" />
      ) : null}
      <View style={s.body}>
        {preview.site ? <Text style={s.site} numberOfLines={1}>{preview.site}</Text> : null}
        {preview.title ? <Text style={s.title} numberOfLines={2}>{preview.title}</Text> : null}
        {preview.description ? <Text style={s.desc} numberOfLines={2}>{preview.description}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderLeftWidth: 3,
    borderLeftColor: '#14B8A6',
    maxWidth: 260,
  },
  cardMe: {
    backgroundColor: 'rgba(0,0,0,0.20)',
    borderLeftColor: '#5EEAD4',
  },
  image: {
    width: '100%', height: 130, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  body: { paddingHorizontal: 10, paddingVertical: 8, gap: 2 },
  site: { color: '#5EEAD4', fontSize: 10, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  title: { color: '#F1F5F9', fontSize: 13, fontWeight: '700', lineHeight: 17 },
  desc: { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 15, marginTop: 1 },
});
