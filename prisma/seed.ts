import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('Seeding pilot data...')

  // ── Negocio 1: Minimercado JM ───────────────────────────────────────────────
  const jm = await db.business.upsert({
    where: { slug: 'minimercado-jm' },
    update: {},
    create: {
      name: 'Minimercado JM',
      slug: 'minimercado-jm',
      currency: 'COP',
      locale: 'es-CO',
      barcodeEnabled: true,
    },
  })

  await db.user.upsert({
    where: { email: 'bibiana.jm@ventory.co' },
    update: {},
    create: {
      email: 'bibiana.jm@ventory.co',
      password: await bcrypt.hash('VentoryJM2026', 12),
      name: 'Bibiana',
      role: 'ADMIN',
      businessId: jm.id,
    },
  })

  const branchJM = await db.branch.upsert({
    where: { id: `branch-seed-${jm.id}` },
    update: {},
    create: {
      id: `branch-seed-${jm.id}`,
      name: 'Sucursal Principal',
      businessId: jm.id,
    },
  })

  const catBebidas = await db.category.upsert({
    where: { businessId_name: { businessId: jm.id, name: 'Bebidas' } },
    update: {},
    create: { name: 'Bebidas', businessId: jm.id },
  })
  const catLacteos = await db.category.upsert({
    where: { businessId_name: { businessId: jm.id, name: 'Lácteos' } },
    update: {},
    create: { name: 'Lácteos', businessId: jm.id },
  })
  const catEnlatados = await db.category.upsert({
    where: { businessId_name: { businessId: jm.id, name: 'Enlatados' } },
    update: {},
    create: { name: 'Enlatados', businessId: jm.id },
  })
  const catSnacks = await db.category.upsert({
    where: { businessId_name: { businessId: jm.id, name: 'Snacks' } },
    update: {},
    create: { name: 'Snacks', businessId: jm.id },
  })
  const catAseo = await db.category.upsert({
    where: { businessId_name: { businessId: jm.id, name: 'Aseo' } },
    update: {},
    create: { name: 'Aseo', businessId: jm.id },
  })
  const catGranos = await db.category.upsert({
    where: { businessId_name: { businessId: jm.id, name: 'Granos' } },
    update: {},
    create: { name: 'Granos', businessId: jm.id },
  })

  const jmProducts = [
    { sku: 'BEB001', name: 'Agua Cristal 600ml',         barcode: '7702001000016', price: 1800,  cost: 1100, categoryId: catBebidas.id,   stock: 120, minStock: 24 },
    { sku: 'BEB002', name: 'Coca Cola 400ml',             barcode: '7702001000023', price: 2500,  cost: 1600, categoryId: catBebidas.id,   stock: 96,  minStock: 24 },
    { sku: 'LAC001', name: 'Leche Entera Parmalat 1L',    barcode: '7702001000030', price: 4200,  cost: 3100, categoryId: catLacteos.id,   stock: 60,  minStock: 12 },
    { sku: 'LAC002', name: 'Yogurt Alpina Fresa 150g',    barcode: '7702001000047', price: 2200,  cost: 1500, categoryId: catLacteos.id,   stock: 48,  minStock: 12 },
    { sku: 'ENL001', name: 'Atún Van Camps 170g',         barcode: '7702001000054', price: 5800,  cost: 4200, categoryId: catEnlatados.id, stock: 36,  minStock: 6  },
    { sku: 'ENL002', name: 'Sardinas Diva 170g',          barcode: '7702001000061', price: 4500,  cost: 3100, categoryId: catEnlatados.id, stock: 24,  minStock: 6  },
    { sku: 'SNK001', name: 'Papas Margarita Natural 30g', barcode: '7702001000078', price: 1500,  cost: 900,  categoryId: catSnacks.id,    stock: 80,  minStock: 20 },
    { sku: 'SNK002', name: 'Chitos Rizados 40g',          barcode: '7702001000085', price: 1500,  cost: 900,  categoryId: catSnacks.id,    stock: 60,  minStock: 20 },
    { sku: 'ASE001', name: 'Jabón Protex 125g',           barcode: '7702001000092', price: 3800,  cost: 2600, categoryId: catAseo.id,      stock: 30,  minStock: 6  },
    { sku: 'GRA001', name: 'Arroz Diana 1kg',             barcode: '7702001000108', price: 5200,  cost: 3800, categoryId: catGranos.id,    stock: 50,  minStock: 10 },
  ]

  for (const p of jmProducts) {
    const { stock, minStock, ...data } = p
    const product = await db.product.upsert({
      where: { businessId_sku: { businessId: jm.id, sku: data.sku } },
      update: {},
      create: { ...data, taxRate: 0.19, businessId: jm.id },
    })
    await db.inventory.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branchJM.id } },
      update: {},
      create: { productId: product.id, branchId: branchJM.id, quantity: stock, minStock },
    })
  }

  // ── Negocio 2: Bora y Bora ─────────────────────────────────────────────────
  const bb = await db.business.upsert({
    where: { slug: 'bora-y-bora' },
    update: {},
    create: {
      name: 'Bora y Bora',
      slug: 'bora-y-bora',
      currency: 'COP',
      locale: 'es-CO',
      barcodeEnabled: false,
    },
  })

  await db.user.upsert({
    where: { email: 'mar_u_79@hotmail.com' },
    update: {},
    create: {
      email: 'mar_u_79@hotmail.com',
      password: await bcrypt.hash('VentoryBB2026', 12),
      name: 'Paula',
      role: 'ADMIN',
      businessId: bb.id,
    },
  })

  await db.user.upsert({
    where: { email: 'sergiobetan650@hotmail.com' },
    update: {},
    create: {
      email: 'sergiobetan650@hotmail.com',
      password: await bcrypt.hash('VentoryBB2026', 12),
      name: 'Sergio',
      role: 'ADMIN',
      businessId: bb.id,
    },
  })

  const branchBB = await db.branch.upsert({
    where: { id: `branch-seed-${bb.id}` },
    update: {},
    create: {
      id: `branch-seed-${bb.id}`,
      name: 'Sucursal Principal',
      businessId: bb.id,
    },
  })

  const catRopaMujer = await db.category.upsert({
    where: { businessId_name: { businessId: bb.id, name: 'Ropa Mujer' } },
    update: {},
    create: { name: 'Ropa Mujer', businessId: bb.id },
  })
  const catRopaHombre = await db.category.upsert({
    where: { businessId_name: { businessId: bb.id, name: 'Ropa Hombre' } },
    update: {},
    create: { name: 'Ropa Hombre', businessId: bb.id },
  })
  const catAccesorios = await db.category.upsert({
    where: { businessId_name: { businessId: bb.id, name: 'Accesorios' } },
    update: {},
    create: { name: 'Accesorios', businessId: bb.id },
  })
  const catCalzado = await db.category.upsert({
    where: { businessId_name: { businessId: bb.id, name: 'Calzado' } },
    update: {},
    create: { name: 'Calzado', businessId: bb.id },
  })

  const bbProducts = [
    { sku: 'RM001',  name: 'Blusa Casual Mujer S',     price: 45000,  cost: 22000, categoryId: catRopaMujer.id,  stock: 15, minStock: 3 },
    { sku: 'RM002',  name: 'Jean Skinny Mujer 28',      price: 89000,  cost: 42000, categoryId: catRopaMujer.id,  stock: 10, minStock: 2 },
    { sku: 'RM003',  name: 'Vestido Floral Mujer M',    price: 75000,  cost: 36000, categoryId: catRopaMujer.id,  stock: 8,  minStock: 2 },
    { sku: 'RH001',  name: 'Camiseta Básica Hombre M',  price: 35000,  cost: 16000, categoryId: catRopaHombre.id, stock: 20, minStock: 4 },
    { sku: 'RH002',  name: 'Jean Recto Hombre 32',      price: 95000,  cost: 46000, categoryId: catRopaHombre.id, stock: 10, minStock: 2 },
    { sku: 'RH003',  name: 'Camisa Cuadros Hombre L',   price: 65000,  cost: 30000, categoryId: catRopaHombre.id, stock: 12, minStock: 3 },
    { sku: 'ACC001', name: 'Cinturón Cuero Negro',       price: 28000,  cost: 12000, categoryId: catAccesorios.id, stock: 25, minStock: 5 },
    { sku: 'ACC002', name: 'Gorro Tejido Unisex',        price: 22000,  cost: 9000,  categoryId: catAccesorios.id, stock: 18, minStock: 4 },
    { sku: 'CAL001', name: 'Tenis Casual Mujer 37',      price: 120000, cost: 58000, categoryId: catCalzado.id,    stock: 6,  minStock: 2 },
    { sku: 'CAL002', name: 'Zapato Sport Hombre 42',     price: 135000, cost: 64000, categoryId: catCalzado.id,    stock: 6,  minStock: 2 },
  ]

  for (const p of bbProducts) {
    const { stock, minStock, ...data } = p
    const product = await db.product.upsert({
      where: { businessId_sku: { businessId: bb.id, sku: data.sku } },
      update: {},
      create: { ...data, taxRate: 0.19, businessId: bb.id },
    })
    await db.inventory.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branchBB.id } },
      update: {},
      create: { productId: product.id, branchId: branchBB.id, quantity: stock, minStock },
    })
  }

  console.log('✓ 2 negocios piloto creados con aislamiento multi-tenant')
  console.log(`  ${jm.name} — barcodeEnabled: true — 6 categorías, 10 productos`)
  console.log(`  ${bb.name} — barcodeEnabled: false — 4 categorías, 10 productos`)
  console.log('')
  console.log('Cuentas piloto:')
  console.log('  Minimercado JM — Bibiana:  bibiana.jm@ventory.co / VentoryJM2026 (ADMIN)')
  console.log('  Bora y Bora    — Paula:    mar_u_79@hotmail.com / VentoryBB2026 (ADMIN)')
  console.log('  Bora y Bora    — Sergio:   sergiobetan650@hotmail.com / VentoryBB2026 (ADMIN)')
}

main()
  .then(async () => { await db.$disconnect() })
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
