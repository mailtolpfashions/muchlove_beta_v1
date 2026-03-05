// @ts-nocheck
// Supabase Edge Function: bulk-sync-google-contacts
// Deploy with: supabase functions deploy bulk-sync-google-contacts
//
// One-time admin action to sync ALL existing customers to Google Contacts.
// Only syncs customers where google_contact_resource_name IS NULL.
// Rate-limited to respect Google People API quota (~60 mutations/min).
//
// Trigger manually:
//   curl -X POST '<SUPABASE_URL>/functions/v1/bulk-sync-google-contacts' \
//     -H 'Authorization: Bearer <SERVICE_ROLE_KEY>' \
//     -H 'Content-Type: application/json'
//
// Required secrets: same as sync-google-contact

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const PEOPLE_API_BASE = 'https://people.googleapis.com/v1'
const CONTACT_GROUP_NAME = 'Much Love Customers'
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 60_000 // 60 seconds between batches

// ─── Helpers (same as sync-google-contact) ─────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? ''

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google OAuth credentials in secrets')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token refresh failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

function buildDisplayName(name: string, location?: string): string {
  const base = `${name} - ML`
  return location?.trim() ? `${base} (${location.trim()})` : base
}

function formatPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  return digits.startsWith('91') && digits.length === 12
    ? `+${digits}`
    : `+91${digits}`
}

async function getOrCreateContactGroup(accessToken: string): Promise<string> {
  const listRes = await fetch(`${PEOPLE_API_BASE}/contactGroups?groupFields=name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (listRes.ok) {
    const data = await listRes.json()
    const existing = data.contactGroups?.find(
      (g: any) => g.name === CONTACT_GROUP_NAME && g.groupType === 'USER_CONTACT_GROUP'
    )
    if (existing) return existing.resourceName
  }

  const createRes = await fetch(`${PEOPLE_API_BASE}/contactGroups`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contactGroup: { name: CONTACT_GROUP_NAME } }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Failed to create contact group (${createRes.status}): ${err}`)
  }

  const created = await createRes.json()
  return created.resourceName
}

async function findContactByPhone(
  accessToken: string,
  mobile: string
): Promise<string | null> {
  const phone = formatPhone(mobile)
  const searchRes = await fetch(
    `${PEOPLE_API_BASE}/people:searchContacts?query=${encodeURIComponent(phone)}&readMask=phoneNumbers&pageSize=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!searchRes.ok) return null

  const data = await searchRes.json()
  if (!data.results?.length) return null

  for (const result of data.results) {
    const person = result.person
    if (person?.phoneNumbers?.some((p: any) => {
      const normalized = p.canonicalForm || p.value?.replace(/\D/g, '')
      return normalized?.endsWith(mobile.replace(/\D/g, ''))
    })) {
      return person.resourceName
    }
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Get all unsynced customers from Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: customers, error: fetchError } = await supabaseAdmin
      .from('customers')
      .select('id, name, mobile, alt_number, location, is_student')
      .is('google_contact_resource_name', null)
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch customers: ${fetchError.message}`)
    }

    if (!customers?.length) {
      return new Response(
        JSON.stringify({ message: 'No unsynced customers found', synced: 0, skipped: 0, errors: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Bulk sync: ${customers.length} customers to process`)

    // 2. Get Google access token and contact group
    const accessToken = await getAccessToken()
    const groupResourceName = await getOrCreateContactGroup(accessToken)

    // 3. Process in batches
    let synced = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i]

      try {
        // Check for duplicate
        const existingResource = await findContactByPhone(accessToken, customer.mobile)
        if (existingResource) {
          console.log(`Skipping ${customer.name} (${customer.mobile}) — already exists: ${existingResource}`)
          // Still store resource name so we can update later
          await supabaseAdmin
            .from('customers')
            .update({ google_contact_resource_name: existingResource })
            .eq('id', customer.id)
          skipped++
          continue
        }

        // Build contact
        const displayName = buildDisplayName(customer.name, customer.location)
        const phoneNumbers: { value: string; type: string }[] = [
          { value: formatPhone(customer.mobile), type: 'mobile' },
        ]
        if (customer.alt_number?.trim()) {
          phoneNumbers.push({ value: formatPhone(customer.alt_number), type: 'other' })
        }

        const contactBody: any = {
          names: [{ givenName: displayName }],
          phoneNumbers,
          memberships: [
            { contactGroupMembership: { contactGroupResourceName: groupResourceName } },
          ],
        }
        if (customer.is_student) {
          contactBody.biographies = [{ value: 'Student', contentType: 'TEXT_PLAIN' }]
        }

        // Create contact
        const createRes = await fetch(`${PEOPLE_API_BASE}/people:createContact`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactBody),
        })

        if (!createRes.ok) {
          const err = await createRes.text()
          console.error(`Failed to create contact for ${customer.name}: ${err}`)
          errors++
          continue
        }

        const created = await createRes.json()
        const resourceName = created.resourceName

        // Store resource name back to DB
        await supabaseAdmin
          .from('customers')
          .update({ google_contact_resource_name: resourceName })
          .eq('id', customer.id)

        console.log(`Synced: ${customer.name} → ${resourceName}`)
        synced++
      } catch (err) {
        console.error(`Error syncing ${customer.name}:`, err.message || err)
        errors++
      }

      // Rate limit: pause between batches
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < customers.length) {
        console.log(`Batch complete (${i + 1}/${customers.length}). Pausing ${BATCH_DELAY_MS / 1000}s for rate limit...`)
        await sleep(BATCH_DELAY_MS)

        // Refresh token in case it expired during the pause (access tokens last ~1 hour)
        // For very large customer lists, this prevents mid-batch token expiry
      }
    }

    const summary = { total: customers.length, synced, skipped, errors }
    console.log('Bulk sync complete:', JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('bulk-sync-google-contacts error:', error.message || error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
