// @ts-nocheck
// Supabase Edge Function: push-fraud-alert
// Deploy with: supabase functions deploy push-fraud-alert
//
// Called by database triggers (detect_reinstall, detect_shadow_mismatch)
// when fraud is detected. Sends push notifications to all admin devices.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FraudPayload {
  user_id: string
  user_name: string
  reason: 'reinstall_unsynced_sales' | 'shadow_mismatch'
  unsynced_count: number
  old_install_id?: string
  new_install_id?: string
  oldest_shadow?: string
}

const REASON_LABELS: Record<string, { title: string; body: (p: FraudPayload) => string }> = {
  reinstall_unsynced_sales: {
    title: '⚠️ Fraud Alert: App Reinstalled',
    body: (p) =>
      `${p.user_name || 'Staff'} reinstalled the app with ${p.unsynced_count} unsynced sale(s). Account auto-locked.`,
  },
  shadow_mismatch: {
    title: '⚠️ Fraud Alert: Missing Sales',
    body: (p) =>
      `${p.user_name || 'Staff'} has ${p.unsynced_count} sale(s) recorded but never synced (oldest: ${
        p.oldest_shadow ? new Date(p.oldest_shadow).toLocaleString('en-IN') : 'unknown'
      }). Account auto-locked.`,
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: FraudPayload = await req.json()
    const { reason, user_name } = payload

    if (!reason) {
      return new Response(JSON.stringify({ error: 'Missing reason' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all admin user IDs
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')

    if (adminError || !admins?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No admins to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminIds = admins.map((a: { id: string }) => a.id)

    // Get push tokens for admins
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .in('user_id', adminIds)

    if (tokenError || !tokens?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No push tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build notification
    const config = REASON_LABELS[reason] || {
      title: '⚠️ Fraud Alert',
      body: () => `Suspicious activity detected for ${user_name || 'a staff member'}.`,
    }

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title: config.title,
      body: config.body(payload),
      data: { type: 'fraud_alert', user_id: payload.user_id, reason },
      channelId: 'sales',
      priority: 'high',
    }))

    // Send via Expo Push API
    const chunks = []
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100))
    }

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? ''

    let totalSent = 0
    for (const chunk of chunks) {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      }
      if (expoAccessToken) {
        headers['Authorization'] = `Bearer ${expoAccessToken}`
      }

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      })

      if (response.ok) {
        totalSent += chunk.length
      } else {
        console.error('Expo push error:', await response.text())
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Fraud alert error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
