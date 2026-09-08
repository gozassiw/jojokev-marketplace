import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/clients'

export const runtime = 'nodejs'

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TRANSACTPAY_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.warn('[webhook] TRANSACTPAY_WEBHOOK_SECRET is not configured; accepting provider payload for compatibility')
    return true
  }
  if (!signature) return false
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  try { return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) } catch { return false }
}

function first(value: any) { return Array.isArray(value) ? value[0] : value }

function providerState(event: any, data: any): 'successful' | 'failed' | 'pending' | 'unknown' {
  const statuses = [
    data?.status,
    data?.paymentStatus,
    data?.orderSummary?.status,
    first(data?.orderPayments)?.status,
  ].filter(Boolean).map(value => String(value).toLowerCase())
  const statusIds = [data?.statusId, data?.orderSummary?.statusId, first(data?.orderPayments)?.statusId]
    .map(value => Number(value)).filter(Number.isFinite)
  const eventName = String(event?.event ?? event?.type ?? '').toLowerCase()
  const failureWords = ['failed', 'failure', 'reversed', 'reverse', 'rejected', 'cancelled', 'canceled', 'expired', 'declined']
  const successWords = ['success', 'successful', 'completed', 'paid']
  if (statuses.some(status => failureWords.some(word => status.includes(word))) || statusIds.some(id => [4, 6].includes(id)) || failureWords.some(word => eventName.includes(word))) return 'failed'
  if (statuses.some(status => successWords.some(word => status.includes(word))) || statusIds.includes(5) || eventName.includes('payment.success')) return 'successful'
  if (statuses.some(status => ['pending', 'processing', 'initiated', 'awaiting-confirmation', 'awaiting_confirmation'].some(word => status.includes(word))) || statusIds.some(id => [1, 2, 3, 7].includes(id))) return 'pending'
  return 'unknown'
}

function getReference(event: any, data: any) {
  return data?.orderReference ?? data?.reference ?? data?.orderSummary?.orderReference ?? event?.orderReference ?? event?.reference
}

function getAmountMajor(data: any) {
  return data?.totalAmountCharged ?? data?.orderAmount ?? data?.orderSummary?.totalChargedAmount ?? data?.orderSummary?.orderAmount ?? data?.amount
}

function amountToKobo(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null
}

function failureReason(data: any, state: string) {
  return String(data?.paymentResponseMessage ?? data?.orderSummary?.paymentResponseMessage ?? data?.remarks ?? data?.message ?? `TransactPay payment ${state}`).slice(0, 500)
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-transactpay-signature') ?? req.headers.get('verif-hash') ?? req.headers.get('signature')
  if (!verifySignature(rawBody, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  let event: any
  try { event = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  const data = event?.data ?? event
  const reference = getReference(event, data)
  const state = providerState(event, data)
  const amountMajor = getAmountMajor(data)
  const amountPaidKobo = amountToKobo(amountMajor)
  const statusIdValue = Number(data?.statusId ?? data?.orderSummary?.statusId ?? first(data?.orderPayments)?.statusId)
  const eventKey = crypto.createHash('sha256').update(rawBody).digest('hex')
  const db = supabaseAdmin()

  const { error: eventInsertError } = await db.from('payment_webhook_events').insert({
    event_key: eventKey,
    order_reference: reference ? String(reference) : null,
    provider_status: String(data?.status ?? data?.paymentStatus ?? data?.orderSummary?.status ?? state),
    provider_status_id: Number.isFinite(statusIdValue) ? statusIdValue : null,
    amount_kobo: amountPaidKobo,
    payload: event,
  })
  if (eventInsertError?.code === '23505') {
    const { data: existingEvent } = await db.from('payment_webhook_events').select('processed').eq('event_key', eventKey).single()
    if (existingEvent?.processed) return NextResponse.json({ received: true, note: 'duplicate webhook' })
  } else if (eventInsertError) {
    console.error('[webhook] could not record event', eventInsertError)
  }

  if (!reference) return NextResponse.json({ received: true, note: 'ignored event without order reference' })
  const { data: order } = await db.from('orders').select('id, order_number, total_kobo, status').eq('payment_reference', String(reference)).single()
  if (!order) return NextResponse.json({ received: true, note: 'unknown order reference' })

  const reason = failureReason(data, state)
  if (state === 'failed') {
    const { error } = await db.rpc('reverse_paid_order', { p_order_id: order.id, p_reason: reason })
    if (error) return NextResponse.json({ error: 'Reversal handling failed' }, { status: 500 })
    await db.from('payment_webhook_events').update({ processed: true }).eq('event_key', eventKey)
    return NextResponse.json({ received: true, note: 'failed or reversed payment recorded' })
  }

  if (state === 'pending' || state === 'unknown') {
    await db.from('orders').update({ payment_provider_status: String(data?.status ?? data?.paymentStatus ?? state), payment_failure_reason: null }).eq('id', order.id)
    await db.from('payment_webhook_events').update({ processed: true }).eq('event_key', eventKey)
    return NextResponse.json({ received: true, note: 'non-final payment status recorded' })
  }

  if (amountPaidKobo === null || amountPaidKobo !== Number(order.total_kobo)) {
    const mismatchReason = `Payment amount mismatch. Expected ${Number(order.total_kobo) / 100} NGN; provider reported ${amountMajor ?? 'no amount'}.`
    const { error } = await db.rpc('reverse_paid_order', { p_order_id: order.id, p_reason: mismatchReason })
    if (error) return NextResponse.json({ error: 'Amount-mismatch handling failed' }, { status: 500 })
    await db.from('payment_webhook_events').update({ processed: true, provider_status: 'Failed', payload: { ...event, reconciliation: mismatchReason } }).eq('event_key', eventKey)
    return NextResponse.json({ received: true, note: 'amount mismatch; payment not settled' })
  }

  if (order.status !== 'awaiting_payment') {
    await db.from('orders').update({ payment_provider_status: 'Successful', payment_failure_reason: null }).eq('id', order.id)
    await db.from('payment_webhook_events').update({ processed: true }).eq('event_key', eventKey)
    return NextResponse.json({ received: true, note: 'already processed' })
  }

  const { error: settlementError } = await db.rpc('settle_paid_order', { p_order_id: order.id })
  if (settlementError) return NextResponse.json({ error: 'Settlement failed' }, { status: 500 })
  await db.from('orders').update({ payment_provider_status: 'Successful', payment_failure_reason: null }).eq('id', order.id)
  await db.from('payment_webhook_events').update({ processed: true }).eq('event_key', eventKey)
  return NextResponse.json({ received: true })
}
