/**
 * List detail screen — items grouped by store (multi-store), check off items,
 * add item, item status, photo confirmations, substitutions, comments.
 *
 * Big touch targets (≥48pt per row). Uses useList + usePatchItem.
 */

import React, { useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react-native'
import type { ShoppingItem } from '@shopnest/shared'
import {
  useAddComment,
  useAddItemPhoto,
  useCreateItemConfirmation,
  useDeleteItem,
  useList,
  usePatchItem,
  useStartSession,
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
  Title,
} from '../../components/ui'
import { ConnectionBanner } from '../../components/connection-banner'
import { useRealtime } from '../../lib/realtime'
import { captureConfirmationPhoto } from '../../lib/photo'

type Group = { storeName: string; storeId: string; data: ShoppingItem[] }

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const list = useList(id)
  const patchItem = usePatchItem(activeHousehold?.id ?? '')
  const deleteItem = useDeleteItem(activeHousehold?.id ?? '')
  const addItemPhoto = useAddItemPhoto()
  const addComment = useAddComment()
  const createConfirmation = useCreateItemConfirmation()
  const startSession = useStartSession(activeHousehold?.id ?? '')

  const [addItemOpen, setAddItemOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [newUnit, setNewUnit] = useState('pc')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [creating, setCreating] = useState(false)

  const sections = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const it of list.data?.list.items ?? []) {
      const key = it.store?.id ?? 'none'
      const g = map.get(key) ?? {
        storeId: key,
        storeName: it.store?.name ?? 'Unassigned',
        data: [],
      }
      g.data.push(it)
      map.set(key, g)
    }
    return Array.from(map.values())
  }, [list.data])

  if (list.isLoading) {
    return <LoadingState label="Loading list…" />
  }
  if (!list.data?.list) {
    return <EmptyState title="List not found" hint="It may have been deleted." />
  }

  const togglePurchased = (it: ShoppingItem) => {
    patchItem.mutate({
      id: it.id,
      patch: { status: it.status === 'PURCHASED' ? 'PENDING' : 'PURCHASED' },
    })
  }

  const markUnavailable = (it: ShoppingItem) => {
    patchItem.mutate({ id: it.id, patch: { status: 'UNAVAILABLE' } })
  }

  const substitute = (it: ShoppingItem) => {
    // Alert.prompt is iOS-only; on Android we fall back to a message directing
    // the user to the item sheet on web. A full native modal for substitution
    // would be a follow-up enhancement.
    type AlertCtor = typeof Alert & { prompt?: (...args: unknown[]) => void }
    const withPrompt = Alert as AlertCtor
    if (typeof withPrompt.prompt === 'function') {
      withPrompt.prompt(
        'Substitute item',
        `What did you get instead of “${it.name}”?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (text: string) => {
              if (text) {
                patchItem.mutate({
                  id: it.id,
                  patch: { status: 'SUBSTITUTED', substitutedWith: text },
                })
              }
            },
          },
        ],
        'plain-text',
      )
    } else {
      Alert.alert(
        'Substitute item',
        'Substitution text entry is supported on iOS for now. Use the web app or the item detail sheet to set a substitute name.',
      )
    }
  }

  const askFamily = async (it: ShoppingItem) => {
    const dataUrl = await captureConfirmationPhoto()
    try {
      await createConfirmation.mutateAsync({
        itemId: it.id,
        req: { note: 'Is this the right product?', photoDataUrl: dataUrl ?? null },
      })
      Alert.alert('Sent', 'Your family will see the photo and respond.')
    } catch (e: unknown) {
      Alert.alert('Could not ask family', e instanceof Error ? e.message : '')
    }
  }

  const addItem = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      // create via the lists items endpoint — we use the patchItem mutation's
      // api helper directly here through a small inline mutation. The shared
      // useCreateItem hook requires householdId+listId; we have both.
      const { api } = await import('../../lib/api-client')
      await api(`/api/lists/${id}/items`, {
        method: 'POST',
        body: {
          name: newName.trim(),
          quantity: Number(newQty) || 1,
          unit: newUnit,
        },
        label: 'Add item',
      })
      setNewName('')
      setNewQty('1')
      setNewUnit('pc')
      setAddItemOpen(false)
      // Manually invalidate via the queryClient (patchItem's onSuccess handles
      // household-scoped keys; here we just refetch the list).
      list.refetch()
    } catch (e: unknown) {
      Alert.alert('Could not add item', e instanceof Error ? e.message : '')
    } finally {
      setCreating(false)
    }
  }

  const startShopping = () => {
    startSession.mutate(
      { listId: id },
      { onSuccess: (res) => router.push(`/shopping-mode/${res.session.id}`) },
    )
  }

  const submitComment = (it: ShoppingItem) => {
    if (!commentText.trim()) return
    addComment.mutate(
      { itemId: it.id, text: commentText.trim() },
      { onSuccess: () => setCommentText('') },
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title={`${list.data.list.emoji ?? '🛒'} ${list.data.list.name}`}
        subtitle={`${list.data.list.items.length} items · ${list.data.list.store?.name ?? 'Multi-store'}`}
        right={
          <Button
            label="Shop"
            size="sm"
            onPress={startShopping}
            loading={startSession.isPending}
            icon={<ShoppingBag color="#fff" size={16} />}
          />
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {sections.length === 0 ? (
        <EmptyState
          title="This list is empty"
          hint="Add items with the button below."
          action={<Button label="Add item" onPress={() => setAddItemOpen(true)} />}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={`${section.storeName} · ${section.data.length}`} />
          )}
          renderSectionFooter={() => <View style={{ height: SPACING.sm }} />}
          renderItem={({ item: it }) => {
            const expanded = expandedItem === it.id
            const purchased = it.status === 'PURCHASED'
            const unavailable = it.status === 'UNAVAILABLE'
            const substituted = it.status === 'SUBSTITUTED'
            return (
              <Card style={{ marginBottom: SPACING.sm }}>
                <Pressable
                  onPress={() => setExpandedItem(expanded ? null : it.id)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <View style={styles.row}>
                    <Pressable onPress={() => togglePurchased(it)} hitSlop={8} accessibilityLabel={purchased ? 'Mark pending' : 'Mark purchased'}>
                      <CheckCircle2
                        color={purchased ? BRAND.green : unavailable ? BRAND.red : BRAND.grayLight}
                        fill={purchased ? BRAND.green : 'none'}
                        size={28}
                      />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, purchased && styles.strikeThrough, unavailable && styles.muted]}>
                        {it.name}
                      </Text>
                      <Caption muted>
                        {it.quantity} {it.unit}
                        {it.note ? ` · ${it.note}` : ''}
                        {it.addedBy ? ` · ${it.addedBy.name}` : ''}
                        {purchased && it.purchasedBy ? ` · got it ${it.purchasedBy.name}` : ''}
                      </Caption>
                      {substituted && it.substitutedWith && (
                        <Pill label={`Sub: ${it.substitutedWith}`} backgroundColor="#fff7ed" color="#9a3412" />
                      )}
                      {unavailable && <Pill label="Unavailable" backgroundColor="#fef2f2" color={BRAND.red} />}
                      {it.photos && it.photos.length > 0 && (
                        <Caption muted style={{ marginTop: 4 }}>
                          📷 {it.photos.length} photo{it.photos.length === 1 ? '' : 's'}
                        </Caption>
                      )}
                    </View>
                    {expanded ? (
                      <ChevronUp color={BRAND.textMuted} size={18} />
                    ) : (
                      <ChevronDown color={BRAND.textMuted} size={18} />
                    )}
                  </View>
                </Pressable>

                {expanded && (
                  <View style={styles.actions}>
                    <Button label="Purchased" size="sm" variant={purchased ? 'primary' : 'outline'} onPress={() => togglePurchased(it)} />
                    <Button label="Unavailable" size="sm" variant={unavailable ? 'danger' : 'outline'} onPress={() => markUnavailable(it)} />
                    <Button label="Substitute" size="sm" variant="outline" onPress={() => substitute(it)} />
                    <Button label="📷 Ask family" size="sm" variant="outline" onPress={() => askFamily(it)} />
                    <Button
                      label="Delete"
                      size="sm"
                      variant="ghost"
                      danger
                      onPress={() => deleteItem.mutate(it.id)}
                      icon={<Trash2 color={BRAND.red} size={14} />}
                    />

                    {/* Comments */}
                    <View style={styles.commentsBox}>
                      <Subtitle>Comments & decisions</Subtitle>
                      {(it.comments ?? []).length === 0 && <Caption muted>No comments yet.</Caption>}
                      {(it.comments ?? []).map((c) => (
                        <View key={c.id} style={styles.comment}>
                          <View style={[styles.avatar, { backgroundColor: c.user.avatarColor }]}>
                            <Text style={styles.avatarText}>
                              {c.user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Body>
                              <Text style={{ fontWeight: '600' }}>{c.user.name}: </Text>
                              {c.text}
                            </Body>
                            <Caption muted>{c.kind.toLowerCase()}</Caption>
                          </View>
                        </View>
                      ))}
                      <View style={styles.commentInputRow}>
                        <TextInput
                          style={styles.commentInput}
                          value={commentText}
                          onChangeText={setCommentText}
                          placeholder="Add a comment…"
                          placeholderTextColor={BRAND.textMuted}
                        />
                        <Button label="Send" size="sm" onPress={() => submitComment(it)} disabled={!commentText.trim()} />
                      </View>
                    </View>
                  </View>
                )}
              </Card>
            )
          }}
        />
      )}

      <Pressable
        onPress={() => setAddItemOpen(true)}
        style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityLabel="Add item"
      >
        <Plus color="#fff" size={24} />
      </Pressable>

      <Modal visible={addItemOpen} animationType="slide" transparent onRequestClose={() => setAddItemOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <View style={styles.modalHeader}>
              <Subtitle>Add item to {list.data.list.name}</Subtitle>
              <Pressable onPress={() => setAddItemOpen(false)} hitSlop={8}>
                <X color={BRAND.textMuted} size={20} />
              </Pressable>
            </View>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Milk"
              placeholderTextColor={BRAND.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Qty</Text>
                <TextInput
                  style={styles.input}
                  value={newQty}
                  onChangeText={setNewQty}
                  keyboardType="decimal-pad"
                  placeholderTextColor={BRAND.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={newUnit}
                  onChangeText={setNewUnit}
                  placeholder="pc / kg / L…"
                  placeholderTextColor={BRAND.textMuted}
                  autoCapitalize="none"
                />
              </View>
            </View>
            <Button
              label="Use voice input"
              variant="outline"
              size="sm"
              style={{ marginTop: SPACING.md }}
              onPress={() => router.push({ pathname: '/add-item', params: { listId: id } })}
              icon={<Camera color={BRAND.green} size={16} />}
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setAddItemOpen(false)} style={{ flex: 1 }} />
              <Button label="Add" onPress={addItem} loading={creating} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: BRAND.textPrimary,
  },
  strikeThrough: {
    textDecorationLine: 'line-through',
    color: BRAND.textMuted,
  },
  muted: { color: BRAND.textMuted },
  actions: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  commentsBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: BRAND.bgSubtle,
    borderRadius: RADIUS.md,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  commentInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: BRAND.white,
    color: BRAND.textPrimary,
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
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
