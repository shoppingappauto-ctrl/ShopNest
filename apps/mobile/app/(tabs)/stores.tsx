/**
 * Stores tab — list of household stores, add store, specialty categories
 * (HALAL / BANGLADESHI).
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
import { Plus, Star, Store as StoreIcon, Trash2 } from 'lucide-react-native'
import {
  STORE_CATEGORIES,
  STORE_CATEGORY_EMOJI,
  STORE_CATEGORY_LABEL,
  STORE_CATEGORIES as SCATS,
  WELL_KNOWN_STORES,
  type StoreCategory,
} from '@shopnest/shared'
import {
  useCreateStore,
  useDeleteStore,
  useOutstanding,
  usePatchStore,
  useStores,
} from '../../lib/hooks'
import { useAuth } from '../../lib/auth'
import { BRAND, RADIUS, SPACING, TYPO } from '../../lib/theme'
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
} from '../../components/ui'
import { ConnectionBanner } from '../../components/connection-banner'
import { useRealtime } from '../../lib/realtime'

export default function StoresTab() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const stores = useStores(householdId)
  const outstanding = useOutstanding(householdId)
  const createStore = useCreateStore(householdId ?? '')
  const patchStore = usePatchStore(householdId ?? '')
  const deleteStore = useDeleteStore(householdId ?? '')

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<StoreCategory>('SUPERMARKET')
  const [address, setAddress] = useState('')

  const pendingByStore = new Map<string, number>()
  for (const g of outstanding.data?.groups ?? []) {
    pendingByStore.set(g.storeId, (g.items?.length ?? 0))
  }

  const create = async () => {
    if (!name.trim()) return Alert.alert('Enter a store name')
    try {
      await createStore.mutateAsync({
        name: name.trim(),
        category,
        address: address.trim() || null,
        isFavorite: false,
      })
      setName('')
      setAddress('')
      setCategory('SUPERMARKET')
      setCreateOpen(false)
    } catch (e: unknown) {
      Alert.alert('Could not add store', e instanceof Error ? e.message : '')
    }
  }

  const toggleFavorite = (id: string, current: boolean) => {
    patchStore.mutate({ id, patch: { isFavorite: !current } })
  }

  const remove = (id: string, name: string) => {
    Alert.alert(
      'Remove store?',
      `“${name}” will be removed from your household. Items will keep their store name until reassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteStore.mutate(id),
        },
      ],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title="Stores"
        subtitle={activeHousehold?.name ?? ''}
        right={
          <Pressable onPress={() => setCreateOpen(true)} hitSlop={12} accessibilityLabel="Add store">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {stores.isLoading ? (
        <LoadingState label="Loading stores…" />
      ) : (stores.data?.stores.length ?? 0) === 0 ? (
        <EmptyState
          title="No stores yet"
          hint="Add your supermarket, halal market, or Bangladeshi grocer."
          action={<Button label="Add store" onPress={() => setCreateOpen(true)} />}
        />
      ) : (
        <FlatList
          data={stores.data?.stores ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListHeaderComponent={
            <SectionHeader title={`${stores.data?.stores.length ?? 0} stores`} />
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <Text style={styles.emoji}>{STORE_CATEGORY_EMOJI[item.category] ?? '🏬'}</Text>
                <View style={{ flex: 1 }}>
                  <Subtitle>{item.name}</Subtitle>
                  <Caption muted>
                    {STORE_CATEGORY_LABEL[item.category] ?? item.category}
                    {item.address ? ` · ${item.address}` : ''}
                  </Caption>
                </View>
                <Pressable onPress={() => toggleFavorite(item.id, item.isFavorite)} hitSlop={12} accessibilityLabel="Toggle favorite">
                  <Star color={item.isFavorite ? BRAND.amber : BRAND.textMuted} fill={item.isFavorite ? BRAND.amber : 'none'} size={20} />
                </Pressable>
              </View>
              <View style={[styles.row, { paddingTop: SPACING.sm }]}>
                <View style={styles.counts}>
                  <Pill
                    label={`${pendingByStore.get(item.id) ?? 0} pending`}
                    backgroundColor="#f0fdf4"
                    color={BRAND.green}
                  />
                  <Pill
                    label={`${item._count?.lists ?? 0} lists`}
                    backgroundColor={BRAND.bgSubtle}
                    color={BRAND.textSecondary}
                  />
                </View>
                <Pressable onPress={() => remove(item.id, item.name)} hitSlop={12} accessibilityLabel="Remove store">
                  <Trash2 color={BRAND.red} size={18} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Add a store</Subtitle>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Al Aqsa Halal Market"
              placeholderTextColor={BRAND.textMuted}
            />
            <Text style={[styles.label, { marginTop: SPACING.sm }]}>Suggestions</Text>
            <View style={styles.chipsRow}>
              {WELL_KNOWN_STORES.slice(0, 8).map((s) => (
                <Pressable key={s} onPress={() => setName(s)} style={styles.chip}>
                  <Text style={{ color: BRAND.textSecondary }}>{s}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.label, { marginTop: SPACING.md }]}>Category</Text>
            <View style={styles.chipsRow}>
              {STORE_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c as StoreCategory)}
                  style={[styles.chip, category === c && styles.chipActive]}
                >
                  <Text style={{ color: category === c ? '#fff' : BRAND.textSecondary }}>
                    {STORE_CATEGORY_EMOJI[c]} {STORE_CATEGORY_LABEL[c] ?? c}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.label, { marginTop: SPACING.md }]}>Address (optional)</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Street / neighborhood"
              placeholderTextColor={BRAND.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
              <Button label="Add" onPress={create} loading={createStore.isPending} style={{ flex: 1 }} />
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
  emoji: { fontSize: 22 },
  counts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
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
