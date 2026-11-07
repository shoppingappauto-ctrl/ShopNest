/**
 * Planner tab — household events list, create event, event templates.
 * Tapping an event navigates to /event/[id].
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
import { Link, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CalendarDays, Plus } from 'lucide-react-native'
import {
  EVENT_TYPES,
  EVENT_TYPE_EMOJI,
  EVENT_TYPE_LABEL,
  type EventType,
} from '@shopnest/shared'
import { useCreateEvent, useEvents } from '../../lib/hooks'
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

export default function PlannerTab() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const events = useEvents(householdId)
  const createEvent = useCreateEvent(householdId ?? '')

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<EventType>('GATHERING')
  const [date, setDate] = useState('')
  const [guestCount, setGuestCount] = useState('')

  const create = async () => {
    if (!name.trim()) return Alert.alert('Enter an event name')
    try {
      const isoDate = date.trim() ? new Date(date.trim()).toISOString() : null
      const gc = guestCount.trim() ? Number(guestCount) : null
      const res = await createEvent.mutateAsync({
        name: name.trim(),
        type,
        date: isoDate,
        guestCount: Number.isFinite(gc) ? gc : null,
      })
      setCreateOpen(false)
      setName('')
      setGuestCount('')
      setDate('')
      setType('GATHERING')
      router.push(`/event/${res.event.id}`)
    } catch (e: unknown) {
      Alert.alert('Could not plan event', e instanceof Error ? e.message : '')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title="Planner"
        subtitle={activeHousehold?.name ?? ''}
        right={
          <Pressable onPress={() => setCreateOpen(true)} hitSlop={12} accessibilityLabel="Plan event">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {events.isLoading ? (
        <LoadingState label="Loading events…" />
      ) : (events.data?.events.length ?? 0) === 0 ? (
        <EmptyState
          title="No events yet"
          hint="Plan a birthday, Eid dinner, or BBQ. We'll help with a checklist."
          action={<Button label="Plan an event" onPress={() => setCreateOpen(true)} />}
        />
      ) : (
        <FlatList
          data={events.data?.events ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListHeaderComponent={<SectionHeader title="Upcoming & templates" />}
          renderItem={({ item }) => (
            <Link href={`/event/${item.id}`} asChild>
              <Pressable>
                <Card>
                  <View style={styles.row}>
                    <Text style={styles.emoji}>{EVENT_TYPE_EMOJI[item.type] ?? '📅'}</Text>
                    <View style={{ flex: 1 }}>
                      <Subtitle>{item.name}</Subtitle>
                      <Caption muted>
                        {EVENT_TYPE_LABEL[item.type] ?? item.type}
                        {item.date ? ` · ${new Date(item.date).toLocaleDateString()}` : ''}
                        {item.guestCount ? ` · ${item.guestCount} guests` : ''}
                      </Caption>
                    </View>
                    <Pill
                      label={item.status === 'COMPLETED' ? 'Done' : 'Planning'}
                      backgroundColor={item.status === 'COMPLETED' ? '#f0fdf4' : BRAND.bgSubtle}
                      color={item.status === 'COMPLETED' ? BRAND.green : BRAND.textSecondary}
                    />
                  </View>
                  {item.items?.length > 0 && (
                    <Caption muted style={{ marginTop: SPACING.sm }}>
                      {item.items.length} checklist item{item.items.length === 1 ? '' : 's'}
                    </Caption>
                  )}
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Plan an event</Subtitle>
            <Text style={styles.label}>Event name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Eid family dinner"
              placeholderTextColor={BRAND.textMuted}
            />
            <Text style={[styles.label, { marginTop: SPACING.sm }]}>Type</Text>
            <View style={styles.chipsRow}>
              {EVENT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t as EventType)}
                  style={[styles.chip, type === t && styles.chipActive]}
                >
                  <Text style={{ color: type === t ? '#fff' : BRAND.textSecondary }}>
                    {EVENT_TYPE_EMOJI[t]} {EVENT_TYPE_LABEL[t] ?? t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.label, { marginTop: SPACING.sm }]}>Date (YYYY-MM-DD, optional)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2025-08-12"
              placeholderTextColor={BRAND.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={[styles.label, { marginTop: SPACING.sm }]}>Guests (optional)</Text>
            <TextInput
              style={styles.input}
              value={guestCount}
              onChangeText={setGuestCount}
              placeholder="12"
              placeholderTextColor={BRAND.textMuted}
              keyboardType="number-pad"
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setCreateOpen(false)} style={{ flex: 1 }} />
              <Button label="Plan" onPress={create} loading={createEvent.isPending} style={{ flex: 1 }} />
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
