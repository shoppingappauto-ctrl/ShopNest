/**
 * Lists tab — all shopping lists, create list, multi-store item counts per list.
 */

import React, { useMemo, useState } from 'react'
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
import { Link, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus, ListChecks, ShoppingBag } from 'lucide-react-native'
import {
  useCreateList,
  useLists,
  useOutstanding,
  useStartSession,
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
  Subtitle,
} from '../../components/ui'
import { ConnectionBanner as Banner } from '../../components/connection-banner'
import { useRealtime } from '../../lib/realtime'

export default function ListsTab() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const lists = useLists(householdId)
  const stores = useStores(householdId)
  const outstanding = useOutstanding(householdId)
  const createList = useCreateList(householdId ?? '')
  const startSession = useStartSession(householdId ?? '')

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🛒')
  const [storeId, setStoreId] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) return Alert.alert('Enter a name')
    try {
      await createList.mutateAsync({
        name: name.trim(),
        emoji: emoji || '🛒',
        storeId: storeId ?? null,
      })
      setName('')
      setEmoji('🛒')
      setStoreId(null)
      setCreateOpen(false)
    } catch (e: unknown) {
      Alert.alert('Could not create list', e instanceof Error ? e.message : '')
    }
  }

  const startShopping = (listId: string) => {
    startSession.mutate(
      { listId },
      {
        onSuccess: (res) => router.push(`/shopping-mode/${res.session.id}`),
        onError: () => Alert.alert('Could not start shopping'),
      },
    )
  }

  // Per-list multi-store breakdown from outstanding groups
  const storesByList = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const g of outstanding.data?.groups ?? []) {
      for (const it of g.items ?? []) {
        const set = map.get(it.listId) ?? new Set<string>()
        if (g.storeName && g.storeName !== 'Unassigned') set.add(g.storeName)
        map.set(it.listId, set)
      }
    }
    return map
  }, [outstanding.data])

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title="Shopping lists"
        subtitle={activeHousehold?.name ?? ''}
        right={
          <Pressable onPress={() => setCreateOpen(true)} hitSlop={12} accessibilityLabel="Create list">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <Banner status={status} queueCount={queueCount} />

      {lists.isLoading ? (
        <LoadingState label="Loading lists…" />
      ) : (lists.data?.lists.length ?? 0) === 0 ? (
        <EmptyState
          title="No lists yet"
          hint="Create a list to start adding items."
          action={<Button label="Create list" onPress={() => setCreateOpen(true)} />}
        />
      ) : (
        <FlatList
          data={lists.data?.lists ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          renderItem={({ item }) => {
            const multi = storesByList.get(item.id)
            return (
              <Link href={`/list/${item.id}`} asChild>
                <Pressable>
                  <Card>
                    <View style={styles.row}>
                      <Text style={styles.emoji}>{item.emoji ?? '🛒'}</Text>
                      <View style={{ flex: 1 }}>
                        <Subtitle>{item.name}</Subtitle>
                        <Caption muted>
                          {item.store?.name ?? 'No default store'}
                          {multi && multi.size > 1 ? ` · ${multi.size} stores` : ''}
                        </Caption>
                      </View>
                    </View>
                    <View style={[styles.row, { paddingTop: SPACING.sm }]}>
                      <View style={styles.counts}>
                        {item.counts && item.counts.pending > 0 && (
                          <Pill label={`${item.counts.pending} pending`} />
                        )}
                        {item.counts && item.counts.purchased > 0 && (
                          <Pill
                            label={`${item.counts.purchased} ✓`}
                            backgroundColor="#f0fdf4"
                            color={BRAND.green}
                          />
                        )}
                        {item.counts && item.counts.unavailable > 0 && (
                          <Pill
                            label={`${item.counts.unavailable} ✗`}
                            backgroundColor="#fef2f2"
                            color={BRAND.red}
                          />
                        )}
                        {item.counts && item.counts.total === 0 && <Caption muted>Empty</Caption>}
                      </View>
                      <Button
                        label="Shop"
                        size="sm"
                        variant="outline"
                        onPress={() => startShopping(item.id)}
                        icon={<ShoppingBag color={BRAND.green} size={16} />}
                      />
                    </View>
                  </Card>
                </Pressable>
              </Link>
            )
          }}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Create a list</Subtitle>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Weekly groceries"
              placeholderTextColor={BRAND.textMuted}
            />
            <Text style={[styles.label, { marginTop: SPACING.md }]}>Emoji (optional)</Text>
            <TextInput
              style={styles.input}
              value={emoji}
              onChangeText={setEmoji}
              placeholder="🛒"
              placeholderTextColor={BRAND.textMuted}
            />
            <Text style={[styles.label, { marginTop: SPACING.md }]}>Default store (optional)</Text>
            <View style={styles.chipsRow}>
              <Pressable
                onPress={() => setStoreId(null)}
                style={[styles.chip, !storeId && styles.chipActive]}
              >
                <Text style={{ color: !storeId ? '#fff' : BRAND.textSecondary }}>None</Text>
              </Pressable>
              {(stores.data?.stores ?? []).slice(0, 6).map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setStoreId(s.id)}
                  style={[styles.chip, storeId === s.id && styles.chipActive]}
                >
                  <Text style={{ color: storeId === s.id ? '#fff' : BRAND.textSecondary }}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
              <Button label="Create" onPress={create} loading={createList.isPending} style={{ flex: 1 }} />
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
  label: { ...TYPO.label, color: BRAND.textSecondary, marginBottom: 6, marginTop: SPACING.sm },
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
