import { constants, createPublicKey, publicEncrypt } from 'node:crypto'

/**
 * Transactpay server client.
 * The provider requires every payment-order payload to be RSA PKCS#1 v1.5
 * encrypted with the dashboard encryption key and sent as { data }.
 */

const BASE = (process.env.TRANSACTPAY_BASE_URL || 'https://payment-api-service.transactpay.ai').replace(/\/$/, '')
const PUBLIC = process.env.TRANSACTPAY_PUBLIC_KEY?.trim()
const SECRET = process.env.TRANSACTPAY_SECRET_KEY?.trim()
const ENCRYPTION = process.env.TRANSACTPAY_ENCRYPTION_KEY?.trim()

if (!PUBLIC) console.warn('[transactpay] TRANSACTPAY_PUBLIC_KEY is not configured')
if (!ENCRYPTION) console.warn('[transactpay] TRANSACTPAY_ENCRYPTION_KEY is not configured')

type TPResponse<T> = { status?: string | boolean; statusCode?: string; message?: string; data?: T; [k: string]: any }

function toBase64Url(input: string): string {
  return Buffer.from(input, 'base64').toString('base64url')
}

/** Convert Transactpay's base64 XML RSA key (4096!<RSAKeyValue>...) to a Node key. */
function getEncryptionKey(): ReturnType<typeof createPublicKey> {
  if (!ENCRYPTION) throw new Error('Transactpay encryption key is not configured.')
  if (ENCRYPTION.includes('BEGIN')) return createPublicKey(ENCRYPTION)

  const decoded = Buffer.from(ENCRYPTION, 'base64').toString('utf8').replace(/^4096!/, '')
  const modulus = decoded.match(/<Modulus>([^<]+)<\/Modulus>/i)?.[1]
  const exponent = decoded.match(/<Exponent>([^<]+)<\/Exponent>/i)?.[1]
  if (!modulus || !exponent) {
    throw new Error('Transactpay encryption key is not a supported RSA XML key.')
  }

  return createPublicKey({
    key: { kty: 'RSA', n: toBase64Url(modulus), e: toBase64Url(exponent) },
    format: 'jwk',
  })
}

function encryptPayload(payload: unknown): string {
  const encrypted = publicEncrypt(
    { key: getEncryptionKey(), padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(JSON.stringify(payload), 'utf8'),
  )
  return encrypted.toString('base64')
}

async function tpFetch<T>(path: string, payload: unknown, useSecret = false): Promise<TPResponse<T>> {
  const apiKey = useSecret ? SECRET : PUBLIC
  if (!apiKey) throw new Error(`Transactpay ${useSecret ? 'secret' : 'public'} key is not configured.`)

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({ data: encryptPayload(payload) }),
    cache: 'no-store',
  })

  const text = await res.text()
  let json: TPResponse<T>
  try { json = JSON.parse(text) } catch { json = { message: text } }

  if (!res.ok) {
    console.error('[transactpay] error', path, res.status, JSON.stringify(json))
    throw new Error(json?.message || `Transactpay ${res.status}`)
  }
  return json
}

/** Normalize common Nigerian local formats to the E.164 format required by TransactPay. */
export function normalizeNigeriaPhone(phone?: string): string {
  const compact = String(phone || '').trim().replace(/[\s().-]/g, '')
  if (compact.startsWith('+234')) return compact
  if (compact.startsWith('234')) return `+${compact}`
  if (compact.startsWith('0')) return `+234${compact.slice(1)}`
  return compact
}

/** Create the provider order. Amount is in NGN major units. */
export async function createPaymentOrder(params: {
  reference: string
  amountKobo: number
  customerEmail: string
  customerName: string
  customerPhone?: string
}) {
  const [firstName, ...rest] = params.customerName.trim().split(/\s+/)
  return tpFetch<any>('/payment/order/create', {
    customer: {
      firstname: firstName || 'Customer',
      lastname: rest.join(' ') || 'Customer',
      mobile: normalizeNigeriaPhone(params.customerPhone),
      country: 'NG',
      email: params.customerEmail,
    },
    order: {
      amount: params.amountKobo / 100,
      reference: params.reference,
      description: 'Jojokev marketplace order',
      currency: 'NGN',
    },
    payment: {
      RedirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://jojokev-marketplace-ng.vercel.app'}/orders`,
    },
    paymentMeta: { ipAddress: '0.0.0.0' },
  })
}

/** Retrieve the provider fee and total payable amount for a bank-transfer order. */
export async function getOrderFee(params: { amountKobo: number; currency?: string; paymentOption?: string }) {
  return tpFetch<any>('/payment/order/fee', {
    amount: params.amountKobo / 100,
    currency: params.currency || 'NGN',
    paymentoption: params.paymentOption || 'bank-transfer',
  }, true)
}

/** Request the bank-transfer payment option for a provider order. */
export async function payWithBankTransfer(reference: string) {
  return tpFetch<any>('/payment/order/pay', {
    reference,
    paymentoption: 'bank-transfer',
    country: 'NG',
    BankTransfer: {},
  })
}

/** Poll the provider order status. */
export async function getOrderStatus(reference: string) {
  return tpFetch<any>('/payment/order/status', { reference })
}

/** Payout to a seller's bank account. */
export async function payoutToBank(params: {
  reference: string
  amountKobo: number
  bankCode: string
  accountNumber: string
  accountName: string
  narration?: string
}) {
  return tpFetch<any>('/payout/initiate', {
    payoutDetails: [{
      clientReference: params.reference,
      accountNumber: params.accountNumber,
      bankCode: params.bankCode,
      amount: params.amountKobo / 100,
      description: params.narration || 'Jojokev seller payout',
      accountName: params.accountName,
      creditCurrency: 'NGN',
      debitCurrency: 'NGN',
    }],
  }, true)
}

export async function getBanks() {
  if (!PUBLIC) throw new Error('Transactpay public key is not configured.')
  const res = await fetch(`${BASE}/payment/banks`, {
    headers: { accept: 'application/json', 'api-key': PUBLIC },
    cache: 'no-store',
  })
  return res.json()
}

/** Normalize the documented and legacy bank-transfer response shapes. */
export function extractVirtualAccount(payResponse: any): {
  accountNumber: string
  bankName: string
  accountName?: string
  expiresAt?: string
} | null {
  const root = payResponse?.data ?? payResponse
  const candidates = [
    root?.bankTransferDetails,
    root?.BankTransfer,
    root?.bankTransfer,
    root?.banktransfer,
    root?.paymentDetail,
    root?.paymentDetails,
    root?.payment,
    root,
    payResponse,
  ].filter(Boolean)

  const accountKeys = ['accountNumber', 'accountnumber', 'account_number', 'bankAccount', 'bankaccount', 'recipientAccount', 'accountNo', 'account_no']
  const bankKeys = ['bankName', 'bankname', 'bank_name', 'bank', 'bankProviderName', 'bankProvider']
  const visited = new Set<any>()
  let found: { accountNumber?: unknown; bankName?: unknown; accountName?: unknown; expiresAt?: unknown } | null = null

  function walk(value: any, depth = 0): void {
    if (found || depth > 6 || !value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    const accountKey = accountKeys.find(key => value[key] !== undefined && value[key] !== null && value[key] !== '')
    if (accountKey && typeof value[accountKey] !== 'object') {
      found = {
        accountNumber: value[accountKey],
        bankName: bankKeys.map(key => value[key]).find(Boolean),
        accountName: value.accountName ?? value.accountname,
        expiresAt: value.expiryDate ?? value.expiry_date ?? value.expiresAt ?? value.expires_at,
      }
      return
    }
    for (const child of Object.values(value)) walk(child, depth + 1)
  }

  for (const candidate of candidates) walk(candidate)
  const resolved = found as { accountNumber?: unknown; bankName?: unknown; accountName?: unknown; expiresAt?: unknown } | null
  if (!resolved || !resolved.accountNumber) {
    console.error('[transactpay] no virtual-account details in response:', JSON.stringify(payResponse))
    return null
  }

  const accountNumber = resolved.accountNumber
  const bankName = resolved.bankName
  const accountName = resolved.accountName
  const expiresAt = resolved.expiresAt

  return {
    accountNumber: String(accountNumber),
    bankName: String(bankName ?? 'Bank'),
    accountName: accountName ? String(accountName) : undefined,
    expiresAt: expiresAt ? String(expiresAt) : undefined,
  }
}

export { BASE }
