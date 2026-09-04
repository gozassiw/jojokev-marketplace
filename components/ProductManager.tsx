'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct, deleteProduct, type ActionState } from '@/app/actions/products'
import { formatNaira, koboToNaira } from '@/lib/money'
import { supabaseBrowser } from '@/lib/supabase/browser'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md px-5 py-2.5 disabled:opacity-50">
      {pending ? 'Saving…' : label}
    </button>
  )
}

function ProductForm({ categories, product, onDone }: {
  categories: any[]
  product?: any
  onDone: () => void
}) {
  const action = product ? updateProduct : createProduct
  const [state, formAction] = useFormState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd)
    if (result.success) onDone()
    return result
  }, {})
  const [uploadedImages, setUploadedImages] = useState<string[]>(product?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function uploadImages(files: FileList | null) {
    if (!files?.length) return
    setUploadError('')
    setUploading(true)
    const supabase = supabaseBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploadError('Please sign in again before uploading images.'); setUploading(false); return }
    const urls: string[] = []
    for (const file of Array.from(files).slice(0, 6)) {
      if (!file.type.startsWith('image/')) { setUploadError('Only image files are supported.'); continue }
      if (file.size > 5 * 1024 * 1024) { setUploadError('Each image must be 5MB or smaller.'); continue }
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-80)
      const path = `${user.id}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (error) { setUploadError(error.message); continue }
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    setUploadedImages(current => [...current, ...urls].slice(0, 6))
    setUploading(false)
  }

  return (
    <form action={formAction} className="rounded-xl border bg-white p-5 space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}

      {state.error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{state.error}</div>
      )}
      {state.success && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">{state.success}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <input name="title" required defaultValue={product?.title}
               className="w-full rounded-md border px-3 py-2" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Price (₦) *</label>
          <input name="price" type="number" min="1" step="0.01" required
                 defaultValue={product ? koboToNaira(product.price_kobo) : ''}
                 className="w-full rounded-md border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stock *</label>
          <input name="stock" type="number" min="0" required defaultValue={product?.stock ?? 0}
                 className="w-full rounded-md border px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select name="category_id" defaultValue={product?.category_id ?? ''}
                className="w-full rounded-md border px-3 py-2">
          <option value="">— None —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">Product images</label>
        <input type="hidden" name="images" value={uploadedImages.join(',')} />
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-[#f7f8f6] p-4 text-center transition hover:border-[#14805d] hover:bg-[#e5f6ee]" style={{ borderColor: 'var(--line)' }}>
          <span className="text-3xl">{uploading ? '⏳' : '📷'}</span><span className="mt-2 text-sm font-bold text-slate-700">{uploading ? 'Uploading…' : 'Tap to upload product photos'}</span><span className="mt-1 text-[11px] text-slate-500">Up to 6 images · JPG, PNG or WEBP · 5MB each</span><input type="file" accept="image/*" multiple className="sr-only" onChange={e => uploadImages(e.target.files)} disabled={uploading} />
        </label>
        {uploadError && <p className="mt-2 text-xs font-semibold text-red-600">{uploadError}</p>}
        {uploadedImages.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{uploadedImages.map(url => <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"><img src={url} alt="Product preview" className="h-full w-full object-cover" /><button type="button" onClick={() => setUploadedImages(images => images.filter(image => image !== url))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white">×</button></div>)}</div>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea name="description" rows={4} defaultValue={product?.description}
                  className="w-full rounded-md border px-3 py-2 text-sm" />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publish" defaultChecked={product?.status === 'active'} className="rounded" />
        Publish (visible to shoppers)
      </label>

      <div className="flex gap-3">
        <SubmitButton label={product ? 'Save changes' : 'Create product'} />
        <button type="button" onClick={onDone} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
      </div>
    </form>
  )
}

export default function ProductManager({ products, categories }: { products: any[]; categories: any[] }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const router = useRouter()

  function done() {
    setShowForm(false)
    setEditing(null)
    router.refresh()
  }

  async function onDelist(id: string) {
    if (!window.confirm('Remove this product from the store?')) return
    await deleteProduct(id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {!showForm && !editing && (
        <button type="button" onClick={() => setShowForm(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md px-5 py-2.5">
          + Add product
        </button>
      )}

      {(showForm || editing) && (
        <ProductForm categories={categories} product={editing ?? undefined} onDone={done} />
      )}

      {products.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center text-neutral-500">
          No products yet. Add your first product to start selling.
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Stock</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 max-w-[16rem] truncate">{p.title}</td>
                  <td className="px-4 py-3">{formatNaira(p.price_kobo)}</td>
                  <td className="px-4 py-3">{p.stock}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'active' ? 'bg-emerald-100 text-emerald-800'
                      : p.status === 'draft' ? 'bg-neutral-100 text-neutral-700'
                      : p.status === 'out_of_stock' ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                    }`}>{p.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => { setEditing(p); setShowForm(false) }}
                            className="text-emerald-700 underline mr-3">Edit</button>
                    {p.status !== 'delisted' && (
                      <button type="button" onClick={() => onDelist(p.id)}
                              className="text-red-600 underline">Delist</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
