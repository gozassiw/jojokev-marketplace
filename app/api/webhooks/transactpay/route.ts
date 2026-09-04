import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/clients'

export const runtime = 'nodejs'   // needs the crypto module

/**
 * Timing-safe signature check.
 * ADJUST the header name and algorithm to match TransactPay's dashboard —
 * log the raw headers on your first sandbox payment to confirm.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook] TRANSACTPAY_WEBHOOK_SECRET not set — rejecting')
    return false
  }
  if (!signature) return false

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false   // length mismatch
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature =
    req.headers.get('x-transactpay-signature') ??
    req.headers.get('verif-hash') ??
    req.headers.get('signature')

  if (!verifySignature(rawBody, signature)) {
    console.warn('[webhook] rejected: bad signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try { event = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  const eventType = event?.event ?? event?.type ?? ''
  const data = event?.data ?? event

  if (!String(eventType).includes('success')) {
    return NextResponse.json({ received: true })   // ignore other events
  }

  const reference = data?.reference ?? data?.orderReference
  const amountPaidKobo = Math.round(Number(data?.amount ?? 0) * 100)
  if (!reference) return NextResponse.json({ error: 'No reference' }, { status: 400 })

  const db = supabaseAdmin()
  const { data: order } = await db
    .from('orders').select('id, total_kobo, status').eq('payment_reference', reference).single()

  if (!order) {
    console.error('[webhook] unknown reference', reference)
    return NextResponse.json({ received: true })   // 200 so retries stop
  }

  // IDEMPOTENCY — a retry lands here and does nothing
  if (order.status !== 'awaiting_payment') {
    return NextResponse.json({ received: true, note: 'already processed' })
  }

  // amount check
  if (amountPaidKobo && amountPaidKobo < order.total_kobo) {
    console.error('[webhook] underpayment', { reference, amountPaidKobo, expected: order.total_kobo })
    await db.from('orders').update({ status: 'awaiting_payment' }).eq('id', order.id)
    return NextResponse.json({ received: true, note: 'amount mismatch' })
  }

  // settle: deduct stock, credit hold balances, record commission.
  // One atomic database function — see Stage 4.
  const { error } = await db.rpc('settle_paid_order', { p_order_id: order.id })
  if (error) {
    console.error('[webhook] settlement failed', error)
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 })  // let it retry
  }

  return NextResponse.json({ received: true })
}
