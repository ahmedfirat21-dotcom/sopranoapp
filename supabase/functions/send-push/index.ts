// SopranoChat — Push Notification Sender (Supabase Edge Function)
// Deploy: npx supabase functions deploy send-push --project-ref kpofiuczyjesjlqjxswh
//
// Bu fonksiyon Expo Push API aracılığıyla mobil cihazlara bildirim gönderir.
// Client tarafından doğrudan veya database webhook ile tetiklenebilir.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target_user_id, title, body, data } = await req.json();

    if (!target_user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'target_user_id, title ve body zorunludur.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase client oluştur
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Hedef kullanıcının push token'ını al
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', target_user_id)
      .single();

    if (profileErr || !profile?.push_token) {
      return new Response(
        JSON.stringify({ error: 'Kullanıcıda push token bulunamadı.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Expo Push API'ye gönder
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: profile.push_token,
        title,
        body,
        sound: 'default',
        data: data || {},
      }),
    });

    const pushResult = await pushResponse.json();

    return new Response(
      JSON.stringify({ success: true, result: pushResult }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
