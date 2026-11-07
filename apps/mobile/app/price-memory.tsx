/**
 * Price memory screen — observations history, add price (with store + unit
 * normalization via shared money.ts), price compare per list.
 *
 * Uses dollarsToCents / formatCents / computeUnitPriceCents from
 * @shopnest/shared so the math is decimal-safe and identical to the web app.
 */

import React, { useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus, Trash2 } from 'lucide-react-native'
import {
  computeUnitPriceCents,
  dollarsToCents,
  formatCents,
  UNITS,
  isPriceStale,
} from '@shopnest/shared'
import type { PriceObservation } from '@shopnest/shared'
import {
  useCreatePriceObservation,
  useDeletePriceObservation,
  usePriceObservations,
  useStores,
} from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'
import {
  Body,
  Button,
  Card,
  Caption,
  EmptyState,
  Header,
  LoadingState,
  Pill,
  SectionHeader,
  Subtitle,
} from '../components/ui'
import { ConnectionBanner } from '../components/connection-banner'
import { useRealtime } from '../lib/realtime'

export default function PriceMemoryScreen() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const prices = usePriceObservations(householdId)
  const stores = useStores(householdId)
  const create = useCreatePriceObservation(householdId ?? '')
  const del = useDeletePriceObservation(householdId ?? '')

  const [addOpen, setAddOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [storeName, setStoreName] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState<string>('pc')
  const [total, setTotal] = useState('')

  const add = async () => {
    const cents = dollarsToCents(total)
    if (!itemName.trim() || cents === null || cents <= 0) {
      return Alert.alert('Enter an item name and a valid price')
    }
    // Find store id by name match (case-insensitive).
    const store = (stores.data?.stores ?? []).find(
      (s) => s.name.toLowerCase() === (storeName ?? '').toLowerCase(),
    )
    try {
      await create.mutateAsync({
        itemName: itemName.trim(),
        storeId: store?.id ?? null,
        quantity: Number(quantity) || 1,
        unit,
        totalPriceCents: cents,
      })
      setItemName('')
      setTotal('')
      setQuantity('1')
      setUnit('pc')
      setStoreName(null)
      setAddOpen(false)
    } catch (e: unknown) {
      Alert.alert('Could not save price', e instanceof Error ? e.message : '')
    }
  }

  const renderRow = (o: PriceObservation) => {
    const up = computeUnitPriceCents(o.totalPriceCents, o.quantity, o.unit)
    const stale = isPriceStale(o.observedAt)
    return (
      <Card key={o.id}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Subtitle>{o.itemName}</Subtitle>
            <Caption muted>
              {o.store?.name ?? o.storeName ?? 'Unassigned'} ·{' '}
              {o.quantity} {o.unit} · {new Date(o.observedAt).toLocaleDateString()}
            </Caption>
          </View>
          <Pressable onPress={() => del.mutate(o.id)} hitSlop={8} accessibilityLabel="Remove price observation">
            <Trash2 color={BRAND.red} size={16} />
          </Pressable>
        </View>
        <View style={[styles.row, { marginTop: SPACING.sm }]}>
          <Pill label={formatCents(o.totalPriceCents)} backgroundColor="#f0fdf4" color={BRAND.green} />
          {up && (
            <Pill
              label={`${formatCents(up.unitPriceCents)}/${up.basis}`}
              backgroundColor={BRAND.bgSubtle}
              color={BRAND.textSecondary}
            />
          )}
          {stale && <Pill label="Stale" backgroundColor="#fff7ed" color="#9a3412" />}
        </View>
      </Card>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title="Price memory"
        subtitle="Your household's recorded prices"
        right={
          <Pressable onPress={() => setAddOpen(true)} hitSlop={12} accessibilityLabel="Add price">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {prices.isLoading ? (
        <LoadingState label="Loading prices…" />
      ) : (prices.data?.observations.length ?? 0) === 0 ? (
        <EmptyState
          title="No prices recorded yet"
          hint="Add prices you've seen at the store. We'll show unit-normalized comparisons."
          action={<Button label="Add a price" onPress={() => setAddOpen(true)} />}
        />
      ) : (
        <FlatList
          data={prices.data?.observations ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListHeaderComponent={
            <Card>
              <Caption muted>
                Price Memory is NOT a live retailer pricing API. It remembers prices
                you've entered so you can compare. Estimates are not a checkout total
                and don't claim current shelf prices.
              </Caption>
            </Card>
          }
          renderItem={({ item }) => renderRow(item)}
        />
      )}

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Record a price</Subtitle>

            <Text style={[styles.label, { marginTop: SPACING.md }]}>Item name</Text>
            <TextInput
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Basmati rice"
              placeholderTextColor={BRAND.textMuted}
            />

            <Text style={[styles.label, { marginTop: SPACING.sm }]}>Store (optional)</Text>
            <View style={styles.chipsRow}>
              <Pressable
                onPress={() => setStoreName(null)}
                style={[styles.chip, !storeName && styles.chipActive]}
              >
                <Text style={{ color: !storeName ? '#fff' : BRAND.textSecondary }}>None</Text>
              </Pressable>
              {(stores.data?.stores ?? []).slice(0, 6).map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setStoreName(s.name)}
                  style={[styles.chip, storeName === s.name && styles.chipActive]}
                >
                  <Text style={{ color: storeName === s.name ? '#fff' : BRAND.textSecondary }}>{s.name}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unit</Text>
                <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
                  {UNITS.slice(0, 6).map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setUnit(u)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: unit === u ? BRAND.green : 'transparent',
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: unit === u ? '#fff' : BRAND.textSecondary, fontSize: 13 }}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.label, { marginTop: SPACING.md }]}>Total price (USD)</Text>
            <TextInput
              style={styles.input}
              value={total}
              onChangeText={setTotal}
              placeholder="3.48"
              placeholderTextColor={BRAND.textMuted}
              keyboardType="decimal-pad"
            />

            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} style={{ flex: 1 }} />
              <Button label="Save" onPress={add} loading={create.isPending} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.greenTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  label: { ...TYPO.label, color: BRAND.textSecondary, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: BRAND.white,
    color: BRAND.textPrimary,
    fontSize: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  chipActive: {
    backgroundColor: BRAND.green,
    borderColor: BRAND.green,
  },
})
