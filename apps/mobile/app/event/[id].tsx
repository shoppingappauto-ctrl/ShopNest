/**
 * Event detail screen — event items, assign members, copy to list, duplicate,
 * template save.
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
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CalendarDays,
  Check,
  Copy,
  Plus,
  Trash2,
  Users,
} from 'lucide-react-native'
import {
  EVENT_TYPE_EMOJI,
  EVENT_TYPE_LABEL,
} from '@shopnest/shared'
import {
  useCopyEventToList,
  useCreateEventItem,
  useDeleteEvent,
  useDeleteEventItem,
  useDuplicateEvent,
  useEvent,
  useHousehold,
  useLists,
  usePatchEventItem,
  usePatchEvent,
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
  RowButton,
  SectionHeader,
  Subtitle,
  Title,
} from '../../components/ui'
import { ConnectionBanner } from '../../components/connection-banner'
import { useRealtime } from '../../lib/realtime'

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const event = useEvent(id)
  const household = useHousehold(householdId)
  const lists = useLists(householdId)
  const createItem = useCreateEventItem(householdId ?? '')
  const patchItem = usePatchEventItem(householdId ?? '')
  const delItem = useDeleteEventItem(householdId ?? '')
  const patchEvent = usePatchEvent(householdId ?? '')
  const delEvent = useDeleteEvent(householdId ?? '')
  const copyToList = useCopyEventToList(householdId ?? '')
  const duplicate = useDuplicateEvent(householdId ?? '')

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState('1')
  const [copyListId, setCopyListId] = useState<string | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)

  if (event.isLoading) return <LoadingState label="Loading event…" />
  if (!event.data?.event) {
    return <EmptyState title="Event not found" hint="It may have been deleted." />
  }
  const ev = event.data.event

  const addItem = async () => {
    if (!newName.trim()) return
    try {
      await createItem.mutateAsync({
        eventId: id,
        req: { name: newName.trim(), quantity: Number(newQty) || 1 },
      })
      setNewName('')
      setNewQty('1')
      setAddOpen(false)
    } catch (e: unknown) {
      Alert.alert('Could not add item', e instanceof Error ? e.message : '')
    }
  }

  const toggleDone = (itemId: string, current: boolean) => {
    patchItem.mutate({ id: itemId, patch: { isDone: !current } })
  }

  const assign = (itemId: string, currentAssigneeId: string | null) => {
    const members = household.data?.household.members ?? []
    if (members.length === 0) return Alert.alert('No members to assign')
    Alert.alert(
      'Assign to',
      'Pick a member:',
      [
        { text: 'Unassign', onPress: () => patchItem.mutate({ id: itemId, patch: { assignedToId: null } }) },
        ...members.map((m) => ({
          text: m.user.name,
          onPress: () => patchItem.mutate({ id: itemId, patch: { assignedToId: m.user.id } }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  const doCopy = async () => {
    if (!copyListId) return Alert.alert('Pick a list first')
    try {
      const res = await copyToList.mutateAsync({ eventId: id, listId: copyListId })
      Alert.alert('Copied', `${res.copied} item${res.copied === 1 ? '' : 's'} copied to your list.`)
      setCopyOpen(false)
      setCopyListId(null)
    } catch (e: unknown) {
      Alert.alert('Could not copy', e instanceof Error ? e.message : '')
    }
  }

  const doDuplicate = async (asTemplate: boolean) => {
    try {
      const res = await duplicate.mutateAsync({ eventId: id, asTemplate })
      Alert.alert(asTemplate ? 'Template saved' : 'Duplicated', `Created “${res.event.name}”.`)
      router.push(`/event/${res.event.id}`)
    } catch (e: unknown) {
      Alert.alert('Could not duplicate', e instanceof Error ? e.message : '')
    }
  }

  const removeEvent = () => {
    Alert.alert(
      'Delete event?',
      `“${ev.name}” will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            delEvent.mutate(id, { onSuccess: () => router.replace('/(tabs)/planner') }),
        },
      ],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title={`${EVENT_TYPE_EMOJI[ev.type] ?? '📅'} ${ev.name}`}
        subtitle={`${EVENT_TYPE_LABEL[ev.type] ?? ev.type}${ev.date ? ` · ${new Date(ev.date).toLocaleDateString()}` : ''}${ev.guestCount ? ` · ${ev.guestCount} guests` : ''}`}
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      <FlatList
        data={ev.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View>
            {ev.notes && (
              <Card>
                <Caption muted>Notes</Caption>
                <Body style={{ marginTop: 4 }}>{ev.notes}</Body>
              </Card>
            )}
            <SectionHeader title="Actions" />
            <Card style={{ padding: 0 }}>
              <RowButton
                label="Copy to a shopping list"
                icon={<Copy color={BRAND.green} size={18} />}
                onPress={() => setCopyOpen(true)}
              />
              <RowButton
                label="Duplicate event"
                icon={<Copy color={BRAND.green} size={18} />}
                onPress={() => doDuplicate(false)}
              />
              <RowButton
                label="Save as template"
                icon={<CalendarDays color={BRAND.green} size={18} />}
                onPress={() => doDuplicate(true)}
              />
              <RowButton
                label="Delete event"
                icon={<Trash2 color={BRAND.red} size={18} />}
                danger
                onPress={removeEvent}
              />
            </Card>
            <SectionHeader
              title={`Checklist · ${ev.items?.length ?? 0}`}
              action={
                <Pressable onPress={() => setAddOpen(true)} hitSlop={8}>
                  <Text style={styles.link}>+ Add</Text>
                </Pressable>
              }
            />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Pressable onPress={() => toggleDone(item.id, item.isDone)} hitSlop={8} accessibilityLabel="Toggle done">
                <View style={[styles.check, item.isDone && styles.checkDone]}>
                  {item.isDone && <Check color="#fff" size={14} />}
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, item.isDone && styles.strikeThrough]}>{item.name}</Text>
                <Caption muted>
                  {item.quantity} {item.unit}
                  {item.assignedTo ? ` · assigned to ${item.assignedTo.name}` : ' · unassigned'}
                </Caption>
              </View>
              <Pressable onPress={() => assign(item.id, item.assignedToId)} hitSlop={8}>
                <Users color={BRAND.green} size={18} />
              </Pressable>
              <Pressable onPress={() => delItem.mutate(item.id)} hitSlop={8}>
                <Trash2 color={BRAND.red} size={16} />
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Add to checklist</Subtitle>
            <Text style={styles.label}>Item name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Falooda mix"
              placeholderTextColor={BRAND.textMuted}
              autoFocus
            />
            <Text style={[styles.label, { marginTop: SPACING.sm }]}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={newQty}
              onChangeText={setNewQty}
              keyboardType="decimal-pad"
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setAddOpen(false)} style={{ flex: 1 }} />
              <Button label="Add" onPress={addItem} loading={createItem.isPending} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </Modal>

      <Modal visible={copyOpen} animationType="slide" transparent onRequestClose={() => setCopyOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Copy to a list</Subtitle>
            <Caption muted>Pick a list — already-copied items are skipped.</Caption>
            <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
              {(lists.data?.lists ?? []).map((l) => (
                <Pressable
                  key={l.id}
                  onPress={() => setCopyListId(l.id)}
                  style={[styles.chip, copyListId === l.id && styles.chipActive]}
                >
                  <Text style={{ color: copyListId === l.id ? '#fff' : BRAND.textSecondary }}>
                    {l.emoji} {l.name}
                  </Text>
                </Pressable>
              ))}
              {(lists.data?.lists.length ?? 0) === 0 && <Caption muted>No lists yet.</Caption>}
            </View>
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setCopyOpen(false)} style={{ flex: 1 }} />
              <Button label="Copy" onPress={doCopy} loading={copyToList.isPending} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  link: { color: BRAND.green, fontWeight: '600', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BRAND.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: BRAND.green,
    borderColor: BRAND.green,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: BRAND.textPrimary,
  },
  strikeThrough: { textDecorationLine: 'line-through', color: BRAND.textMuted },
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
