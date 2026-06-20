import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── Negocio 1: Tienda La Esperanza ─────────────────────────────────────────
  const business1 = await db.business.upsert({
    where: { slug: 'la-esperanza' },
    update: {},
    create: { name: 'Tienda La Esperanza', slug: 'la-esperanza' },
  })

  await db.user.upsert({
    where: { email: 'admin@laesperanza.com' },
    update: {},
    create: {
      email: 'admin@laesperanza.com',
      password: await bcrypt.hash('Admin1234!', 12),
      name: 'María González',
      role: 'ADMIN',
      businessId: business1.id,
    },
  })

  await db.user.upsert({
    where: { email: 'cajero@laesperanza.com' },
    update: {},
    create: {
      email: 'cajero@laesperanza.com',
      password: await bcrypt.hash('Cajero1234!', 12),
      name: 'Carlos Ruiz',
      role: 'CASHIER',
      pin: await bcrypt.hash('1234', 12),
      businessId: business1.id,
    },
  })

  // Branch for business 1
  const branch1 = await db.branch.upsert({
    where: { id: `branch-seed-${business1.id}` },
    update: {},
    create: {
      id: `branch-seed-${business1.id}`,
      name: 'Sucursal Principal',
      businessId: business1.id,
    },
  })

  // Categories for business 1
  const catBebidas = await db.category.upsert({
    where: { businessId_name: { businessId: business1.id, name: 'Bebidas' } },
    update: {},
    create: { name: 'Bebidas', businessId: business1.id },
  })
  const catAlimentos = await db.category.upsert({
    where: { businessId_name: { businessId: business1.id, name: 'Alimentos' } },
    update: {},
    create: { name: 'Alimentos', businessId: business1.id },
  })
  const catLimpieza = await db.category.upsert({
    where: { businessId_name: { businessId: business1.id, name: 'Limpieza' } },
    update: {},
    create: { name: 'Limpieza', businessId: business1.id },
  })

  // 10 sample products for business 1
  const products = [
    {
      sku: 'BEB001',
      name: 'Coca Cola 600ml',
      barcode: '7501055300105',
      price: 18.5,
      cost: 12.0,
      unitOfMeasure: 'pieza',
      supplier: 'Distribuidor ARCA',
      categoryId: catBebidas.id,
      stock: 120,
      minStock: 24,
    },
    {
      sku: 'BEB002',
      name: 'Agua Ciel 1L',
      barcode: '7501055308279',
      price: 14.0,
      cost: 8.5,
      unitOfMeasure: 'pieza',
      supplier: 'Distribuidor ARCA',
      categoryId: catBebidas.id,
      stock: 200,
      minStock: 48,
    },
    {
      sku: 'BEB003',
      name: 'Jugo Del Valle 1L Naranja',
      barcode: '7503008007116',
      price: 26.0,
      cost: 18.0,
      unitOfMeasure: 'pieza',
      supplier: 'Distribuidor ARCA',
      categoryId: catBebidas.id,
      stock: 60,
      minStock: 12,
    },
    {
      sku: 'ALI001',
      name: 'Sabritas Adobadas 45g',
      barcode: '7501012551408',
      price: 17.0,
      cost: 11.0,
      unitOfMeasure: 'bolsa',
      supplier: 'PepsiCo México',
      categoryId: catAlimentos.id,
      stock: 80,
      minStock: 20,
    },
    {
      sku: 'ALI002',
      name: 'Marinela Gansito 52g',
      barcode: '7501000653117',
      price: 15.0,
      cost: 9.5,
      unitOfMeasure: 'pieza',
      supplier: 'Grupo Bimbo',
      categoryId: catAlimentos.id,
      stock: 48,
      minStock: 12,
    },
    {
      sku: 'ALI003',
      name: 'Bimbo Blanco 680g',
      barcode: '7501000541000',
      price: 52.0,
      cost: 38.0,
      unitOfMeasure: 'pieza',
      supplier: 'Grupo Bimbo',
      categoryId: catAlimentos.id,
      stock: 30,
      minStock: 6,
    },
    {
      sku: 'ALI004',
      name: 'Arroz SuMesa 1kg',
      barcode: '7506195610038',
      price: 28.0,
      cost: 20.0,
      unitOfMeasure: 'kg',
      supplier: 'Distribuidora Granos',
      categoryId: catAlimentos.id,
      stock: 50,
      minStock: 10,
    },
    {
      sku: 'ALI005',
      name: 'Frijoles La Sierra 560g',
      barcode: '7501025410037',
      price: 32.0,
      cost: 22.0,
      unitOfMeasure: 'lata',
      supplier: 'Distribuidora Granos',
      categoryId: catAlimentos.id,
      stock: 40,
      minStock: 8,
    },
    {
      sku: 'LIM001',
      name: 'Jabón Roma 500g',
      barcode: '7501025112344',
      price: 22.0,
      cost: 14.0,
      unitOfMeasure: 'pieza',
      supplier: 'Henkel México',
      categoryId: catLimpieza.id,
      stock: 36,
      minStock: 6,
    },
    {
      sku: 'LIM002',
      name: 'Pinol Multiusos 828ml',
      barcode: '7501025100990',
      price: 38.0,
      cost: 26.0,
      unitOfMeasure: 'pieza',
      supplier: 'SC Johnson',
      categoryId: catLimpieza.id,
      stock: 24,
      minStock: 4,
    },
  ]

  for (const p of products) {
    const { stock, minStock: minStk, ...productData } = p
    const product = await db.product.upsert({
      where: { businessId_sku: { businessId: business1.id, sku: productData.sku } },
      update: {},
      create: {
        ...productData,
        taxRate: 0.16,
        businessId: business1.id,
      },
    })

    await db.inventory.upsert({
      where: { productId_branchId: { productId: product.id, branchId: branch1.id } },
      update: {},
      create: {
        productId: product.id,
        branchId: branch1.id,
        quantity: stock,
        minStock: minStk,
      },
    })
  }

  // ── Negocio 2: Minimercado El Sol ──────────────────────────────────────────
  const business2 = await db.business.upsert({
    where: { slug: 'minimercado-el-sol' },
    update: {},
    create: { name: 'Minimercado El Sol', slug: 'minimercado-el-sol' },
  })

  await db.user.upsert({
    where: { email: 'admin@elsol.com' },
    update: {},
    create: {
      email: 'admin@elsol.com',
      password: await bcrypt.hash('Admin1234!', 12),
      name: 'Pedro Martínez',
      role: 'ADMIN',
      businessId: business2.id,
    },
  })

  await db.user.upsert({
    where: { email: 'cajero@elsol.com' },
    update: {},
    create: {
      email: 'cajero@elsol.com',
      password: await bcrypt.hash('Cajero1234!', 12),
      name: 'Ana López',
      role: 'CASHIER',
      pin: await bcrypt.hash('5678', 12),
      businessId: business2.id,
    },
  })

  console.log('✓ 2 negocios con aislamiento multi-tenant')
  console.log(`  Negocio 1: ${business1.name} — sucursal: ${branch1.name}`)
  console.log(`  Negocio 2: ${business2.name}`)
  console.log('')
  console.log('✓ 3 categorías y 10 productos con inventario inicial (Negocio 1)')
  console.log('')
  console.log('Cuentas de prueba:')
  console.log('  Negocio 1 — Admin:  admin@laesperanza.com / Admin1234!')
  console.log('  Negocio 1 — Cajero: cajero@laesperanza.com / Cajero1234! (PIN 1234)')
  console.log('  Negocio 2 — Admin:  admin@elsol.com / Admin1234!')
  console.log('  Negocio 2 — Cajero: cajero@elsol.com / Cajero1234! (PIN 5678)')
}

main()
  .then(async () => { await db.$disconnect() })
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
