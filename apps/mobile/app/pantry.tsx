/**
 * Pantry screen — pantry items, add/edit, status (IN_STOCK / RUNNING_LOW /
 * OUT_OF_STOCK / UNKNOWN).
 */

import React, { useState } from 'react'
import {
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
  PANTRY_STATUS_COLOR,
  PANTRY_STATUS_LABEL,
} from '@shopnest/shared'
import type { PantryItem } from '@shopnest/shared'
import {
  useCreatePantryItem,
  useDeletePantryItem,
  usePatchPantryItem,
  usePantry,
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
  RowButton,
  SectionHeader,
  Subtitle,
} from '../components/ui'
import { ConnectionBanner } from '../components/connection-banner'
import { useRealtime } from '../lib/realtime'

const STATUSES: PantryItem['status'][] = ['IN_STOCK', 'RUNNING_LOW', 'OUT_OF_STOCK', 'UNKNOWN']

export default function PantryScreen() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const pantry = usePantry(householdId)
  const create = useCreatePantryItem(householdId ?? '')
  const patch = usePatchPantryItem(householdId ?? '')
  const del = useDeletePantryItem(householdId ?? '')

  const [addOpen, setAddOpen] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')

  const add = async () => {
    if (!name.trim()) return
    try {
      await create.mutateAsync({
        name: name.trim(),
        quantity: quantity.trim() ? Number(quantity) : null,
        unit: unit.trim() || null,
        status: 'IN_STOCK',
      })
      setName('')
      setQuantity('')
      setUnit('')
      setAddOpen(false)
    } catch {
      // swallow — UI shows offline banner
    }
  }

  const cycleStatus = (it: PantryItem) => {
    const idx = STATUSES.indexOf(it.status)
    const next = STATUSES[(idx + 1) % STATUSES.length]
    patch.mutate({ id: it.id, patch: { status: next } })
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title="Pantry"
        subtitle={activeHousehold?.name ?? ''}
        right={
          <Pressable onPress={() => setAddOpen(true)} hitSlop={12} accessibilityLabel="Add pantry item">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {pantry.isLoading ? (
        <LoadingState label="Loading pantry…" />
      ) : (pantry.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="Pantry is empty"
          hint="Track what's in stock, running low, or out."
          action={<Button label="Add item" onPress={() => setAddOpen(true)} />}
        />
      ) : (
        <FlatList
          data={pantry.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListHeaderComponent={<SectionHeader title={`${pantry.data?.items.length ?? 0} items`} />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Subtitle>{item.name}</Subtitle>
                  <Caption muted>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.unit ?? ''}
                    {item.notes ? ` · ${item.notes}` : ''}
                  </Caption>
                </View>
                <Pressable onPress={() => cycleStatus(item)} hitSlop={8} accessibilityLabel="Cycle status">
                  <Pill
                    label={PANTRY_STATUS_LABEL[item.status] ?? item.status}
                    backgroundColor={`${PANTRY_STATUS_COLOR[item.status] ?? BRAND.gray}20`}
                    color={PANTRY_STATUS_COLOR[item.status] ?? BRAND.gray}
                  />
                </Pressable>
                <Pressable onPress={() => del.mutate(item.id)} hitSlop={8} accessibilityLabel="Remove pantry item">
                  <Trash2 color={BRAND.red} size={16} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Add to pantry</Subtitle>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rice"
              placeholderTextColor={BRAND.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  placeholderTextColor={BRAND.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="kg / L / pc"
                  placeholderTextColor={BRAND.textMuted}
                />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} style={{ flex: 1 }} />
              <Button label="Add" onPress={add} loading={create.isPending} style={{ flex: 1 }} />
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
})
