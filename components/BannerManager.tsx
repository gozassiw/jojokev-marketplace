'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createBanner, updateBanner, deleteBanner } from '@/app/actions/admin'
import { supabaseBrowser } from '@/lib/supabase/browser'

type Banner = { id: string; title: string; subtitle: string | null; cta_label: string | null; cta_url: string | null; image_url: string; sort_order: number; is_active: boolean }

type State = { error?: string; success?: string }

function SubmitButton({ editing }: { editing: boolean }) { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">{pending ? 'Saving…' : editing ? 'Save banner' : 'Add banner'}</button> }

export default function BannerManager({ banners }: { banners: Banner[] }) {
  const [editing, setEditing] = useState<Banner | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const router = useRouter()
  const [state, formAction] = useFormState<State, FormData>(async (_prev, formData) => {
    const result = editing ? await updateBanner(formData) : await createBanner(formData)
    if (result.success) { setEditing(null); setImageUrl(''); router.refresh() }
    return result
  }, {})

  function startEdit(banner: Banner) { setEditing(banner); setImageUrl(banner.image_url); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  function reset() { setEditing(null); setImageUrl(''); setUploadError('') }
  async function uploadImage(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Choose an image file.'); return }
    if (file.size > 8 * 1024 * 1024) { setUploadError('Banner images must be 8MB or smaller.'); return }
    setUploadError(''); setUploading(true)
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadError('Please sign in again.'); setUploading(false); return }
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-90)
    const path = `banners/${user.id}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) setUploadError(error.message)
    else setImageUrl(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
    setUploading(false)
  }
  async function remove(id: string) { if (!window.confirm('Delete this banner?')) return; await deleteBanner(id); router.refresh() }

  return <div className="space-y-5">{(state.error || uploadError) && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.error || uploadError}</div>}{state.success && <div className="rounded-xl border border-emerald-200 bg-[#e5f6ee] px-4 py-3 text-sm font-semibold text-[#0b5d43]">{state.success}</div>}<form action={formAction} className="surface p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="section-kicker">{editing ? 'Edit slide' : 'New slide'}</p><h2 className="text-xl font-black">{editing ? 'Update storefront banner' : 'Add a storefront banner'}</h2><p className="mt-1 text-xs text-slate-500">Use a wide image at 1197 × 371 px (about 3.23:1). Slides rotate every 10 seconds.</p></div>{editing && <button type="button" onClick={reset} className="text-xs font-bold text-slate-500 hover:text-red-600">Cancel edit</button>}</div>{editing && <input type="hidden" name="id" value={editing.id} />}<input type="hidden" name="image_url" value={imageUrl} /><div className="mt-5 grid gap-4 lg:grid-cols-2"><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Banner image *</label><label className="flex aspect-[1197/371] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-[#f7f8f6] transition hover:border-[#14805d]" style={{ borderColor: 'var(--line)' }}>{imageUrl ? <img src={imageUrl} alt="Banner preview" className="aspect-[1197/371] w-full object-cover" /> : <div className="text-center"><span className="text-4xl">🖼️</span><p className="mt-2 text-sm font-bold">{uploading ? 'Uploading…' : 'Upload banner image'}</p><p className="mt-1 text-[11px] text-slate-500">JPG, PNG or WEBP · 8MB max · 1197 × 371 px recommended</p></div>}<input type="file" accept="image/*" className="sr-only" onChange={e => uploadImage(e.target.files?.[0])} disabled={uploading} /></label></div><div className="grid gap-4"><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Title *</label><input name="title" required defaultValue={editing?.title ?? ''} className="field" placeholder="Weekend deals are here" /></div><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Subtitle</label><input name="subtitle" defaultValue={editing?.subtitle ?? ''} className="field" placeholder="Fresh prices from local sellers" /></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Button label</label><input name="cta_label" defaultValue={editing?.cta_label ?? ''} className="field" placeholder="Shop deals" /></div><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Button link</label><input name="cta_url" defaultValue={editing?.cta_url ?? '/search'} className="field" placeholder="/search" /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Display order</label><input name="sort_order" type="number" defaultValue={editing?.sort_order ?? 0} className="field" /></div><label className="flex items-center gap-3 self-end rounded-xl bg-[#f7f8f6] px-3 py-3 text-sm font-bold"><input type="checkbox" name="is_active" defaultChecked={editing?.is_active ?? true} className="h-4 w-4 accent-[#14805d]" /> Visible on storefront</label></div></div></div><div className="mt-5 flex flex-wrap gap-3"><SubmitButton editing={!!editing} />{!editing && <button type="button" onClick={reset} className="btn-secondary">Clear</button>}</div></form><section><div className="mb-3 flex items-end justify-between"><div><p className="section-kicker">Your slides</p><h2 className="text-xl font-black">Storefront banners</h2></div><span className="rounded-full bg-[#e5f6ee] px-3 py-1 text-xs font-bold text-[#0b5d43]">{banners.length} total</span></div>{banners.length === 0 ? <div className="surface p-10 text-center text-sm text-slate-500">No banners yet. Add one above and it will appear on the storefront.</div> : <div className="grid gap-4 sm:grid-cols-2">{banners.map(banner => <article key={banner.id} className="surface overflow-hidden"><img src={banner.image_url} alt={banner.title} className="aspect-[1197/371] w-full object-cover" /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{banner.title}</h3><p className="mt-1 text-xs text-slate-500">{banner.subtitle || 'No subtitle'}</p></div><span className={`status-pill ${banner.is_active ? 'bg-[#e5f6ee] text-[#0b5d43]' : 'bg-slate-100 text-slate-500'}`}>{banner.is_active ? 'Live' : 'Hidden'}</span></div><div className="mt-4 flex gap-2"><button type="button" onClick={() => startEdit(banner)} className="btn-secondary px-3 py-2 text-xs">Edit</button><button type="button" onClick={() => remove(banner.id)} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">Delete</button></div></div></article>)}</div>}</section></div>
}
