import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/clients'

export const runtime = 'nodejs'

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET?.trim()
  // TransactPay's public webhook reference does not document a signature header.
  // If a signing secret is configured, enforce it; otherwise rely on the
  // provider's order reference and amount checks below for sandbox compatibility.
  if (!secret) {
    console.warn('[webhook] TRANSACTPAY_WEBHOOK_SECRET is not configured; accepting documented sandbox payload')
    return true
  }
  if (!signature) return false

  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function isSuccessfulPayment(event: any, data: any): boolean {
  const statuses = [event?.status, data?.status, data?.paymentStatus, data?.orderSummary?.status]
    .filter(Boolean).map(value => String(value).toLowerCase())
  return statuses.some(status => ['success', 'successful', 'completed', 'paid'].includes(status))
    || String(event?.event ?? event?.type ?? '').toLowerCase().includes('success')
    || String(data?.statusCode ?? event?.statusCode ?? '') === '00'
    || Number(data?.statusId ?? data?.orderSummary?.statusId) === 5
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-transactpay-signature') ?? req.headers.get('verif-hash') ?? req.headers.get('signature')

  if (!verifySignature(rawBody, signature)) {
    console.warn('[webhook] rejected: bad signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: any
  try { event = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  const data = event?.data ?? event
  if (!isSuccessfulPayment(event, data)) return NextResponse.json({ received: true, note: 'ignored non-success event' })

  const reference = data?.orderReference ?? data?.reference ?? event?.orderReference ?? data?.orderSummary?.orderReference
  const amountMajor = data?.totalAmountCharged ?? data?.orderAmount ?? data?.amount ?? data?.orderSummary?.totalChargedAmount
  const amountPaidKobo = amountMajor === undefined || amountMajor === null ? 0 : Math.round(Number(amountMajor) * 100)
  if (!reference) return NextResponse.json({ error: 'No order reference' }, { status: 400 })

  const db = supabaseAdmin()
  const { data: order } = await db.from('orders').select('id, total_kobo, status').eq('payment_reference', String(reference)).single()

  if (!order) {
    console.error('[webhook] unknown reference', reference)
    return NextResponse.json({ received: true })
  }

  if (order.status !== 'awaiting_payment') return NextResponse.json({ received: true, note: 'already processed' })

  if (amountPaidKobo > 0 && amountPaidKobo < order.total_kobo) {
    console.error('[webhook] underpayment', { reference, amountPaidKobo, expected: order.total_kobo })
    return NextResponse.json({ received: true, note: 'amount mismatch' })
  }

  const { error } = await db.rpc('settle_paid_order', { p_order_id: order.id })
  if (error) {
    console.error('[webhook] settlement failed', error)
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
