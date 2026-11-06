import { db } from '@/lib/db'
import { hashPassword, jsonError, ApiError } from '@/lib/shopnest/auth'

/**
 * Demo data seeding (clearly labeled as demo in the UI).
 *
 * Creates a demo household with two members so the two-user realtime
 * collaboration flow can be tested immediately in the sandbox preview.
 */
const DEMO_EMAIL_1 = 'alex@demo.shopnest'
const DEMO_EMAIL_2 = 'sam@demo.shopnest'
const DEMO_PASSWORD = 'shopnest123'

export async function POST() {
  try {
    let household = await db.household.findFirst({
      where: { name: 'The Demo Family' },
      include: { members: true },
    })

    if (!household) {
      const demoAvatar = (n: number) => ['#16a34a', '#ea580c'][n % 2]

      const alex = await db.user.upsert({
        where: { email: DEMO_EMAIL_1 },
        update: {},
        create: {
          email: DEMO_EMAIL_1,
          name: 'Alex (demo)',
          passwordHash: hashPassword(DEMO_PASSWORD),
          avatarColor: demoAvatar(0),
          emailVerified: true,
        },
      })
      const sam = await db.user.upsert({
        where: { email: DEMO_EMAIL_2 },
        update: {},
        create: {
          email: DEMO_EMAIL_2,
          name: 'Sam (demo)',
          passwordHash: hashPassword(DEMO_PASSWORD),
          avatarColor: demoAvatar(1),
          emailVerified: true,
        },
      })

      household = await db.household.create({
        data: {
          name: 'The Demo Family',
          inviteCode: 'SN-DEMO1',
          members: {
            create: [
              { userId: alex.id, role: 'OWNER' },
              { userId: sam.id, role: 'MEMBER' },
            ],
          },
        },
        include: { members: true },
      })

      // stores
      const walmart = await db.store.create({
        data: { householdId: household.id, name: 'Walmart', category: 'SUPERMARKET', isFavorite: true, address: 'User-entered store' },
      })
      const alAqsa = await db.store.create({
        data: { householdId: household.id, name: 'Al Aqsa Halal Market', category: 'HALAL', isFavorite: true },
      })
      const banglaBazar = await db.store.create({
        data: { householdId: household.id, name: 'Bangla Bazar', category: 'BANGLADESHI' },
      })

      // weekly groceries list
      const list = await db.shoppingList.create({
        data: { householdId: household.id, name: 'Weekly Groceries', emoji: '🛒', storeId: walmart.id, createdById: alex.id },
      })

      const items = [
        { name: 'Milk', category: 'DAIRY', quantity: 2, unit: 'L', status: 'PENDING' },
        { name: 'Bread', category: 'BAKERY', quantity: 1, unit: 'pack', status: 'PENDING' },
        { name: 'Halal chicken (curry cut)', category: 'MEAT', quantity: 2, unit: 'kg', storeId: alAqsa.id, status: 'PENDING' },
        { name: 'Hilsa fish (Ilish)', nameBn: 'ইলিশ', category: 'FISH', quantity: 1, unit: 'kg', storeId: banglaBazar.id, status: 'PENDING' },
        { name: 'Basmati rice', nameBn: 'বাসমতী চাল', category: 'PANTRY', quantity: 5, unit: 'kg', storeId: banglaBazar.id, status: 'PENDING' },
        { name: 'Eggs', category: 'DAIRY', quantity: 1, unit: 'dozen', status: 'PURCHASED' },
        { name: 'Bananas', category: 'PRODUCE', quantity: 2, unit: 'kg', status: 'PURCHASED' },
        { name: 'Diapers', category: 'BABY', quantity: 1, unit: 'pack', status: 'UNAVAILABLE' },
      ]
      for (const it of items) {
        await db.shoppingItem.create({
          data: {
            listId: list.id,
            householdId: household.id,
            name: it.name,
            nameBn: it.nameBn ?? null,
            category: it.category,
            quantity: it.quantity,
            unit: it.unit,
            storeId: it.storeId ?? null,
            status: it.status,
            addedById: sam.id,
            purchasedAt: it.status === 'PURCHASED' ? new Date() : null,
            purchasedById: it.status === 'PURCHASED' ? sam.id : null,
          },
        })
      }

      // household catalog favorites
      const favorites = [
        { name: 'Milk', category: 'DAIRY', defaultQty: 2, unit: 'L', storeId: walmart.id, isRecurring: true, recurrenceDays: 7, timesPurchased: 6, lastPurchasedAt: new Date() },
        { name: 'Bread', category: 'BAKERY', defaultQty: 1, unit: 'pack', storeId: walmart.id, isRecurring: true, recurrenceDays: 4, timesPurchased: 8, lastPurchasedAt: new Date() },
        { name: 'Eggs', category: 'DAIRY', defaultQty: 1, unit: 'dozen', storeId: walmart.id, isRecurring: true, recurrenceDays: 10, timesPurchased: 5, lastPurchasedAt: new Date() },
        { name: 'Diapers', category: 'BABY', defaultQty: 1, unit: 'pack', storeId: walmart.id, isRecurring: true, recurrenceDays: 14, timesPurchased: 3, lastPurchasedAt: new Date() },
        { name: 'Halal chicken (curry cut)', category: 'MEAT', defaultQty: 2, unit: 'kg', storeId: alAqsa.id, timesPurchased: 4, lastPurchasedAt: new Date() },
        { name: 'Mustard oil', nameBn: 'সরিষার তেল', category: 'PANTRY', defaultQty: 1, unit: 'L', storeId: banglaBazar.id, timesPurchased: 2 },
      ]
      for (const f of favorites) {
        await db.householdProduct.create({
          data: { householdId: household.id, ...f, storeId: f.storeId ?? null, recurrenceDays: f.recurrenceDays ?? null, lastPurchasedAt: f.lastPurchasedAt ?? null },
        })
      }

      // event
      const event = await db.householdEvent.create({
        data: {
          householdId: household.id,
          name: 'Eid family dinner',
          type: 'EID',
          date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
          guestCount: 12,
          budget: 250,
          notes: 'Roast chicken, biryani, falooda for dessert.',
        },
      })
      for (const ei of [
        { name: 'Basmati rice', quantity: 10, unit: 'kg' },
        { name: 'Goat meat (khashi)', quantity: 3, unit: 'kg' },
        { name: 'Falooda mix', quantity: 2, unit: 'pack' },
      ]) {
        await db.eventItem.create({
          data: { eventId: event.id, name: ei.name, quantity: ei.quantity, unit: ei.unit, createdById: alex.id },
        })
      }

      // activity
      await db.activity.createMany({
        data: [
          { householdId: household.id, userId: alex.id, type: 'HOUSEHOLD', message: 'Alex (demo) created the household “The Demo Family”.' },
          { householdId: household.id, userId: sam.id, type: 'MEMBER_JOINED', message: 'Sam (demo) joined the household.' },
          { householdId: household.id, userId: sam.id, type: 'ITEM_PURCHASED', message: 'Sam (demo) got “Eggs”.' },
          { householdId: household.id, userId: alex.id, type: 'EVENT', message: 'Alex (demo) planned “Eid family dinner”.' },
        ],
      })
    }

    return Response.json({
      ok: true,
      demo: {
        householdId: household.id,
        accounts: [
          { email: DEMO_EMAIL_1, name: 'Alex (demo)', password: DEMO_PASSWORD, role: 'OWNER' },
          { email: DEMO_EMAIL_2, name: 'Sam (demo)', password: DEMO_PASSWORD, role: 'MEMBER' },
        ],
      },
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error)
  }
}
