#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# SopranoChat — Tek-script Deployment (v63→v68 + edge functions + secrets)
# ═══════════════════════════════════════════════════════════════════════════
# Bunu MANUEL çalıştır:  bash DEPLOY.sh
#
# Önkoşullar:
#   1. supabase CLI yüklü ve `supabase login` yapılmış (sen yapmışsın)
#   2. Projeye linked: kpofiuczyjesjlqjxswh (zaten link'li)
#   3. Aşağıdaki secret'ları DOLDUR (boş bırakmazsan deploy kıracak)
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Bir hata olursa dur

# ── DOLDUR: Secrets ────────────────────────────────────────────────────────
# Resend (https://resend.com → API key)
RESEND_API_KEY=""                               # re_xxxxxxxxxxxxxxxx
EMAIL_FROM="SopranoChat <noreply@sopranochat.com>"

# Supabase Storage S3 — Storage Settings → "S3 Connection" sekmesi
STORAGE_S3_ACCESS_KEY=""                        # 24-char access id
STORAGE_S3_SECRET_KEY=""                        # 40+ char secret
STORAGE_S3_REGION="us-east-1"                   # Supabase default
EGRESS_BUCKET="room-recordings"

# LiveKit env (livekit-token edge function'ında zaten var; burada egress için)
# Bunlar zaten Supabase secrets'ta olmalı — eğer değilse doldur
LIVEKIT_URL=""                                  # wss://<project>.livekit.cloud
LIVEKIT_API_KEY=""                              # APIxxxxxxxxxxxx (mevcut)
LIVEKIT_API_SECRET=""                           # secret (mevcut)

PROJECT_REF="kpofiuczyjesjlqjxswh"

# ═══════════════════════════════════════════════════════════════════════════
echo "▶ 1/4 — Pending migration'ları push ediyorum (v63→v68)..."
supabase db push --linked
echo "✓ Migration'lar canlıda."
echo ""

# ═══════════════════════════════════════════════════════════════════════════
echo "▶ 2/4 — Secrets ayarlanıyor..."

if [ -n "$RESEND_API_KEY" ]; then
  supabase secrets set RESEND_API_KEY="$RESEND_API_KEY" --project-ref "$PROJECT_REF"
  supabase secrets set EMAIL_FROM="$EMAIL_FROM" --project-ref "$PROJECT_REF"
  echo "✓ Resend secrets set."
else
  echo "⚠ RESEND_API_KEY boş — email-digest deploy'unu skip etmek istersen sorun değil."
fi

if [ -n "$STORAGE_S3_ACCESS_KEY" ]; then
  supabase secrets set STORAGE_S3_ACCESS_KEY="$STORAGE_S3_ACCESS_KEY" --project-ref "$PROJECT_REF"
  supabase secrets set STORAGE_S3_SECRET_KEY="$STORAGE_S3_SECRET_KEY" --project-ref "$PROJECT_REF"
  supabase secrets set STORAGE_S3_REGION="$STORAGE_S3_REGION" --project-ref "$PROJECT_REF"
  supabase secrets set EGRESS_BUCKET="$EGRESS_BUCKET" --project-ref "$PROJECT_REF"
  echo "✓ Storage S3 secrets set."
else
  echo "⚠ STORAGE_S3_ACCESS_KEY boş — egress deploy'unu skip etmek istersen sorun değil."
fi

if [ -n "$LIVEKIT_URL" ]; then
  supabase secrets set LIVEKIT_URL="$LIVEKIT_URL" --project-ref "$PROJECT_REF"
  supabase secrets set LIVEKIT_API_KEY="$LIVEKIT_API_KEY" --project-ref "$PROJECT_REF"
  supabase secrets set LIVEKIT_API_SECRET="$LIVEKIT_API_SECRET" --project-ref "$PROJECT_REF"
  echo "✓ LiveKit secrets set."
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
echo "▶ 3/4 — Edge function'lar deploy ediliyor..."

if [ -n "$RESEND_API_KEY" ]; then
  supabase functions deploy send-email-digest --project-ref "$PROJECT_REF"
fi

if [ -n "$STORAGE_S3_ACCESS_KEY" ] && [ -n "$LIVEKIT_API_KEY" ]; then
  supabase functions deploy room-egress --project-ref "$PROJECT_REF"
  supabase functions deploy livekit-webhook --project-ref "$PROJECT_REF"
fi
echo "✓ Edge functions deploy edildi."
echo ""

# ═══════════════════════════════════════════════════════════════════════════
echo "▶ 4/4 — Manuel yapılması gerekenler:"
echo ""
echo "  ✦ Supabase Storage:"
echo "    1. Dashboard → Storage → New bucket: 'room-recordings'"
echo "    2. Public: ON"
echo "    3. Storage settings → S3 Connection → Generate access keys → kopyala"
echo ""
echo "  ✦ Resend (email-digest için):"
echo "    1. https://resend.com → kayıt ol"
echo "    2. API key oluştur → bu script'e RESEND_API_KEY olarak yapıştır"
echo "    3. sopranochat.com domain verify et (DNS TXT record)"
echo ""
echo "  ✦ LiveKit Cloud (egress için):"
echo "    1. LiveKit Cloud panelinde Egress ve Webhooks ayarlarını aç"
echo "    2. Webhook URL olarak şunu ekle:"
echo "       https://${PROJECT_REF}.supabase.co/functions/v1/livekit-webhook"
echo "    3. LIVEKIT_URL, LIVEKIT_API_KEY ve LIVEKIT_API_SECRET değerlerinin"
echo "       Supabase secrets içinde güncel olduğunu doğrula"
echo ""
echo "  ✦ pg_cron (haftalık digest için, opsiyonel):"
echo "    Supabase Dashboard → Database → Extensions → pg_cron enable"
echo "    SQL Editor'de:"
echo "      SELECT cron.schedule('weekly-digest', '0 9 * * 1', \$\$"
echo "        SELECT net.http_post("
echo "          url := 'https://${PROJECT_REF}.supabase.co/functions/v1/send-email-digest',"
echo "          headers := jsonb_build_object('Authorization',"
echo "            'Bearer ' || current_setting('app.service_role_key'))"
echo "        );"
echo "      \$\$);"
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Deploy bitti. Mobil app yeni özellikleri kullanmaya hazır."
echo "═══════════════════════════════════════════════════════════════════════"
