// @ts-nocheck
// Supabase Edge Function: push-request-notification
// Deploy with: supabase functions deploy push-request-notification --no-verify-jwt
//
// Handles two scenarios:
// 1. Employee submits a request → notify all admins
// 2. Admin takes action (approve/reject/revoke) → notify the employee

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestPayload {
  event: 'new_request' | 'request_action'
  // For new_request:
  employee_id?: string
  employee_name?: string
  request_type?: string // 'leave' | 'permission'
  leave_type?: string   // 'leave' | 'compensation' | 'earned'
  reason?: string
  // For request_action:
  action?: string       // 'approved' | 'rejected'
  old_status?: string   // previous status (to detect revoke)
  reviewed_by?: string  // admin who took the action
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: RequestPayload = await req.json()
    const { event } = payload

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? ''

    let messages: any[] = []

    if (event === 'new_request') {
      // Employee submitted a request → notify all admins
      const { employee_id, employee_name, request_type, leave_type, reason } = payload
      if (!employee_id) {
        return new Response(JSON.stringify({ error: 'Missing employee_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get admin tokens (exclude the submitter in case they're also admin)
      const { data: admins } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .neq('id', employee_id)

      if (!admins?.length) {
        return new Response(JSON.stringify({ sent: 0, reason: 'No admins to notify' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const adminIds = admins.map((a: { id: string }) => a.id)
      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .in('user_id', adminIds)

      if (!tokens?.length) {
        return new Response(JSON.stringify({ sent: 0, reason: 'No push tokens' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Determine notification text
      const isCorrection = (reason || '').startsWith('[CORRECTION]')
      let typeLabel = 'Leave Request'
      if (isCorrection) typeLabel = 'Attendance Correction'
      else if (request_type === 'permission') typeLabel = 'Permission Request'
      else if (leave_type === 'compensation') typeLabel = 'Comp Off Request'
      else if (leave_type === 'earned') typeLabel = 'Earned Leave Request'

      messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        sound: 'default',
        title: '📋 New Request',
        body: `${employee_name || 'Employee'} submitted a ${typeLabel}`,
        data: { type: 'request' },
      }))

    } else if (event === 'request_action') {
      // Admin took action → notify the employee
      const { employee_id, action, old_status, reviewed_by } = payload
      if (!employee_id || !action) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Don't notify if the employee cancelled their own request
      if (reviewed_by === employee_id) {
        return new Response(JSON.stringify({ sent: 0, reason: 'Self-cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: tokens } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('user_id', employee_id)

      if (!tokens?.length) {
        return new Response(JSON.stringify({ sent: 0, reason: 'No push tokens' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const isRevoke = action === 'rejected' && old_status === 'approved'
      const emoji = action === 'approved' ? '✅' : '❌'
      const actionLabel = isRevoke ? 'Revoked' : action === 'approved' ? 'Approved' : 'Rejected'

      messages = tokens.map((t: { token: string }) => ({
        to: t.token,
        sound: 'default',
        title: `${emoji} Request ${actionLabel}`,
        body: `Your request has been ${actionLabel.toLowerCase()} by admin`,
        data: { type: 'request_action' },
      }))

    } else {
      return new Response(JSON.stringify({ error: 'Unknown event' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send via Expo Push API
    if (messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const chunks = []
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100))
    }

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

      const responseBody = await response.json()
      console.log('Expo push response:', JSON.stringify(responseBody))

      if (response.ok) {
        totalSent += chunk.length
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
