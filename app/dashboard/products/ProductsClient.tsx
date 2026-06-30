'use client'

import { useState, useEffect, useCallback } from 'react'
import { fmt } from '@/lib/format'

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  price: number
  cost: number | null
  taxRate: number
  unitOfMeasure: string | null
  supplier: string | null
  status: string
  category: { id: string; name: string } | null
  stock: number
  minStock: number
  createdAt: string
}

const EMPTY_FORM = {
  name: '',
  sku: '',
  barcode: '',
  description: '',
  price: '',
  cost: '',
  taxRate: '0.16',
  unitOfMeasure: '',
  supplier: '',
  categoryId: '',
  initialStock: '',
  minStock: '',
}

type FormData = typeof EMPTY_FORM

export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterCategory) params.set('categoryId', filterCategory)
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      setProducts(data.products ?? [])
    } finally {
      setLoading(false)
    }
  }, [search, filterCategory])

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
  }, [])

  useEffect(() => {
    const t = setTimeout(fetchProducts, 200)
    return () => clearTimeout(t)
  }, [fetchProducts])

  function openCreate() {
    setEditProduct(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditProduct(p)
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      description: p.description ?? '',
      price: String(p.price),
      cost: p.cost != null ? String(p.cost) : '',
      taxRate: String(p.taxRate),
      unitOfMeasure: p.unitOfMeasure ?? '',
      supplier: p.supplier ?? '',
      categoryId: p.category?.id ?? '',
      initialStock: String(p.stock),
      minStock: String(p.minStock),
    })
    setError(null)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditProduct(null)
    setError(null)
  }

  function setField(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        description: form.description.trim() || undefined,
        price: parseFloat(form.price),
        cost: form.cost ? parseFloat(form.cost) : undefined,
        taxRate: parseFloat(form.taxRate),
        unitOfMeasure: form.unitOfMeasure.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
        categoryId: form.categoryId || undefined,
      }

      let res: Response
      if (editProduct) {
        res = await fetch(`/api/products/${editProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        if (form.initialStock) body.initialStock = parseInt(form.initialStock)
        if (form.minStock) body.minStock = parseInt(form.minStock)
        res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar el producto')
        return
      }
      closeModal()
      await fetchProducts()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive(p: Product) {
    if (!confirm(`¿Archivar "${p.name}"? El producto ya no estará disponible en el POS.`)) return
    await fetch(`/api/products/${p.id}`, { method: 'DELETE' })
    await fetchProducts()
  }

  const filtered = products

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Productos</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o código de barras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {search || filterCategory ? 'Sin resultados para la búsqueda' : 'No hay productos. Crea el primero.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Categoría</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Precio</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Costo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Stock</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Mín.</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const lowStock = p.stock <= p.minStock
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        {p.sku && <p className="text-xs text-gray-400">SKU: {p.sku}</p>}
                        {p.barcode && <p className="text-xs text-gray-400">Cód: {p.barcode}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(p.price)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.cost != null ? fmt(p.cost) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {lowStock ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {p.stock}
                          </span>
                        ) : (
                          <span className="text-gray-700">{p.stock}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.minStock}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleArchive(p)}
                            className="text-xs text-gray-500 hover:text-red-600 font-medium"
                          >
                            Archivar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <form onSubmit={handleSubmit}>
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">
                  {editProduct ? 'Editar producto' : 'Nuevo producto'}
                </h2>
              </div>

              <div className="p-6 space-y-4">
                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SKU</label>
                    <input
                      value={form.sku}
                      onChange={(e) => setField('sku', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Código de barras</label>
                    <input
                      value={form.barcode}
                      onChange={(e) => setField('barcode', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Precio de venta *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={form.price}
                      onChange={(e) => setField('price', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Costo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.cost}
                      onChange={(e) => setField('cost', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                    <select
                      value={form.categoryId}
                      onChange={(e) => setField('categoryId', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">IVA (ej: 0.16 = 16%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={form.taxRate}
                      onChange={(e) => setField('taxRate', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {!editProduct && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Stock inicial</label>
                        <input
                          type="number"
                          min="0"
                          value={form.initialStock}
                          onChange={(e) => setField('initialStock', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Stock mínimo</label>
                        <input
                          type="number"
                          min="0"
                          value={form.minStock}
                          onChange={(e) => setField('minStock', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Unidad de medida</label>
                    <input
                      value={form.unitOfMeasure}
                      onChange={(e) => setField('unitOfMeasure', e.target.value)}
                      placeholder="pza, kg, lt..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                    <input
                      value={form.supplier}
                      onChange={(e) => setField('supplier', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setField('description', e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Guardando...' : editProduct ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
