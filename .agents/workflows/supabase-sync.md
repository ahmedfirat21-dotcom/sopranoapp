---
description: How to add a new feature with Supabase sync
---

# Yeni Özellik Ekleme — Supabase Senkronizasyonu

Her yeni özellik eklendiğinde aşağıdaki 3 adım uygulanır:

## 1. Supabase Şeması (SQL)
- `supabase-schema.sql` dosyasına yeni tablo/kolon SQL'i ekle
- Kullanıcıya Supabase SQL Editor'da çalıştırmasını söyle
- RLS (Row Level Security) kurallarını unutma
- Gerekiyorsa Realtime'a tablo ekle

## 2. Servis Katmanı (TypeScript)
- `services/database.ts` dosyasına yeni servis fonksiyonları ekle
- Her servis grubu (ProfileService, RoomService, vb.) kendi bölümünde
- Type tanımlarını dosyanın en üstündeki TYPES bölümüne ekle
- Realtime listener gerekiyorsa RealtimeService'e ekle

## 3. UI Bağlantısı (Ekranlar)
- İlgili ekranda servis fonksiyonlarını import et
- `useEffect` ile veri çek
- Kullanıcı etkileşimlerinde servis fonksiyonlarını çağır
- Realtime dinleyici gerekiyorsa cleanup ile birlikte ekle

## Örnek: Yeni "Etkinlikler" özelliği
```sql
-- supabase-schema.sql'e ekle:
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  ...
);
```

```typescript
// services/database.ts'e ekle:
export const EventService = {
  async getAll() { ... },
  async create() { ... },
};
```

```typescript
// app/(tabs)/home.tsx'de kullan:
import { EventService } from '../../services/database';
const events = await EventService.getAll();
```
