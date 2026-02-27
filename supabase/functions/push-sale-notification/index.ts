// @ts-nocheck
// Supabase Edge Function: push-sale-notification
// Deploy with: supabase functions deploy push-sale-notification
//
// This function is called by the database trigger (notify_sale_push)
// whenever a new sale is inserted. It sends Expo push notifications
// to all admin devices except the one who made the sale.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SalePayload {
  sale_id: string
  customer_name: string
  employee_id: string
  employee_name: string
  total: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: SalePayload = await req.json()
    const { customer_name, employee_id, employee_name, total } = payload

    if (!employee_id) {
      return new Response(JSON.stringify({ error: 'Missing employee_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase admin client (uses service_role key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all admin user IDs (except the sale creator)
    const { data: admins, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .neq('id', employee_id)

    if (adminError || !admins?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No admins to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminIds = admins.map((a: { id: string }) => a.id)

    // Get push tokens for those admins
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .in('user_id', adminIds)

    if (tokenError || !tokens?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No push tokens found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build Expo push messages
    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title: '💰 New Sale Recorded',
      body: `${employee_name || 'Staff'} billed ₹${Number(total).toFixed(2)} to ${customer_name || 'Walk-in Customer'}`,
      data: { type: 'sale' },
      channelId: 'sales',
    }))

    // Send via Expo Push API (batch, max 100 per request)
    const chunks = []
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100))
    }

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? ''

    let totalSent = 0
    const allTickets: any[] = []
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

      const responseBody = await response.json()
      console.log('Expo push response:', JSON.stringify(responseBody))

      if (response.ok && responseBody.data) {
        allTickets.push(...responseBody.data)
        totalSent += chunk.length
      } else {
        console.error('Expo push error:', JSON.stringify(responseBody))
      }
    }

    return new Response(JSON.stringify({ sent: totalSent, tickets: allTickets, tokens: tokens.map((t: {token: string}) => t.token) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
