// @ts-nocheck
// Supabase Edge Function: sync-google-contact
// Deploy with: supabase functions deploy sync-google-contact
//
// Called by the database trigger (notify_google_contact_sync) whenever a
// customer is inserted or updated. Syncs the customer to the salon's
// Google Contacts via the Google People API.
//
// Required secrets (set via `supabase secrets set`):
//   GOOGLE_CLIENT_ID       — OAuth2 client ID from Google Cloud Console
//   GOOGLE_CLIENT_SECRET   — OAuth2 client secret
//   GOOGLE_REFRESH_TOKEN   — Refresh token for the salon's Gmail account
//   SUPABASE_URL           — (auto-set by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY — (auto-set by Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const PEOPLE_API_BASE = 'https://people.googleapis.com/v1'
const CONTACT_GROUP_NAME = 'Much Love Customers'

interface CustomerPayload {
  operation: 'INSERT' | 'UPDATE'
  customer_id: string
  customer_name: string
  customer_mobile: string
  customer_alt_number?: string
  customer_location?: string
  is_student: boolean
  old_mobile?: string
  google_contact_resource_name?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Exchange refresh token for a fresh access token */
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

/** Build the contact display name: "Name - ML" or "Name - ML (Location)" */
function buildDisplayName(name: string, location?: string): string {
  const base = `${name} - ML`
  return location?.trim() ? `${base} (${location.trim()})` : base
}

/** Format Indian mobile to +91 (WhatsApp-ready) */
function formatPhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  return digits.startsWith('91') && digits.length === 12
    ? `+${digits}`
    : `+91${digits}`
}

/** Find or create the "Much Love Customers" contact group */
async function getOrCreateContactGroup(accessToken: string): Promise<string> {
  // List existing groups
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

  // Create new group
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

/** Build the Google Contact body */
function buildContactBody(
  payload: CustomerPayload,
  groupResourceName: string
) {
  const displayName = buildDisplayName(payload.customer_name, payload.customer_location)

  const phoneNumbers: { value: string; type: string }[] = [
    { value: formatPhone(payload.customer_mobile), type: 'mobile' },
  ]
  if (payload.customer_alt_number?.trim()) {
    phoneNumbers.push({
      value: formatPhone(payload.customer_alt_number),
      type: 'other',
    })
  }

  const body: any = {
    names: [{ givenName: displayName }],
    phoneNumbers,
    memberships: [
      {
        contactGroupMembership: {
          contactGroupResourceName: groupResourceName,
        },
      },
    ],
  }

  if (payload.is_student) {
    body.biographies = [{ value: 'Student', contentType: 'TEXT_PLAIN' }]
  }

  return body
}

/** Search Google Contacts by phone number to detect duplicates */
async function findContactByPhone(
  accessToken: string,
  mobile: string
): Promise<string | null> {
  const phone = formatPhone(mobile)

  // Use people.searchContacts to find by phone number
  const searchRes = await fetch(
    `${PEOPLE_API_BASE}/people:searchContacts?query=${encodeURIComponent(phone)}&readMask=phoneNumbers&pageSize=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!searchRes.ok) return null

  const data = await searchRes.json()
  if (!data.results?.length) return null

  // Verify the phone actually matches (search can be fuzzy)
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

/** Create a new Google Contact */
async function createGoogleContact(
  accessToken: string,
  contactBody: any
): Promise<string> {
  const res = await fetch(`${PEOPLE_API_BASE}/people:createContact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactBody),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create contact (${res.status}): ${err}`)
  }

  const created = await res.json()
  return created.resourceName
}

/** Update an existing Google Contact */
async function updateGoogleContact(
  accessToken: string,
  resourceName: string,
  contactBody: any
): Promise<string | null> {
  // First get the contact to retrieve its etag (required for updates)
  const getRes = await fetch(
    `${PEOPLE_API_BASE}/${resourceName}?personFields=names,phoneNumbers,biographies,memberships`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!getRes.ok) {
    if (getRes.status === 404) return null // Contact was deleted from Google
    const err = await getRes.text()
    throw new Error(`Failed to get contact (${getRes.status}): ${err}`)
  }

  const existing = await getRes.json()
  const etag = existing.etag

  // Update the contact
  const updateRes = await fetch(
    `${PEOPLE_API_BASE}/${resourceName}:updateContact?updatePersonFields=names,phoneNumbers,biographies,memberships`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...contactBody, etag }),
    }
  )

  if (!updateRes.ok) {
    if (updateRes.status === 404) return null
    const err = await updateRes.text()
    throw new Error(`Failed to update contact (${updateRes.status}): ${err}`)
  }

  const updated = await updateRes.json()
  return updated.resourceName
}

/** Store the Google Contact resource name back to the customers table */
async function storeResourceName(customerId: string, resourceName: string) {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  await supabaseAdmin
    .from('customers')
    .update({ google_contact_resource_name: resourceName })
    .eq('id', customerId)
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: CustomerPayload = await req.json()
    const { operation, customer_id, customer_mobile } = payload

    if (!customer_id || !customer_mobile) {
      return new Response(JSON.stringify({ error: 'Missing customer_id or customer_mobile' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Get Google access token
    const accessToken = await getAccessToken()

    // 2. Find or create the "Much Love Customers" contact group
    const groupResourceName = await getOrCreateContactGroup(accessToken)

    // 3. Build the contact body
    const contactBody = buildContactBody(payload, groupResourceName)

    let resourceName: string | null = null

    if (operation === 'UPDATE' && payload.google_contact_resource_name) {
      // ── UPDATE path: Try to update existing contact ──
      console.log(`Updating Google Contact for customer ${customer_id}: ${payload.google_contact_resource_name}`)

      resourceName = await updateGoogleContact(
        accessToken,
        payload.google_contact_resource_name,
        contactBody
      )

      // If contact was deleted from Google (404), fall through to create
      if (!resourceName) {
        console.log('Contact not found in Google (possibly deleted), creating new one...')
      }
    }

    if (!resourceName) {
      // ── INSERT path (or UPDATE fallback): Check for duplicates, then create ──

      // Check if a contact with this phone already exists
      const existingResource = await findContactByPhone(accessToken, customer_mobile)

      if (existingResource) {
        console.log(`Contact with phone ${customer_mobile} already exists: ${existingResource}, updating instead`)
        resourceName = await updateGoogleContact(accessToken, existingResource, contactBody)
        if (!resourceName) {
          // Existing contact vanished between search and update — create fresh
          resourceName = await createGoogleContact(accessToken, contactBody)
        }
      } else {
        // No duplicate — create new contact
        resourceName = await createGoogleContact(accessToken, contactBody)
        console.log(`Created Google Contact for customer ${customer_id}: ${resourceName}`)
      }
    }

    // 4. Store the resource name back to the DB for future updates
    if (resourceName) {
      await storeResourceName(customer_id, resourceName)
    }

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        customer_id,
        google_resource: resourceName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    // Log the error but return 200 — contact sync should never block customer creation
    console.error('sync-google-contact error:', error.message || error)

    // Log specific message for token issues so admin knows to re-authorize
    if (error.message?.includes('token') || error.message?.includes('401')) {
      console.error('⚠️ Google token may be expired. Admin needs to re-authorize the salon Gmail account and update GOOGLE_REFRESH_TOKEN secret.')
    }

    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 200, // Return 200 even on error — this is best-effort
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
