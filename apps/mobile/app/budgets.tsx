/**
 * Budgets screen — TRIP / WEEKLY / MONTHLY / EVENT scopes, set amount,
 * spent vs budget progress. Decimal-safe via shared money.ts (formatCents).
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
  dollarsToCents,
  formatCents,
} from '@shopnest/shared'
import type { Budget, BudgetScope } from '@shopnest/shared'
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useEvents,
  useLists,
  usePatchBudget,
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

const SCOPES: BudgetScope[] = ['TRIP', 'WEEKLY', 'MONTHLY', 'EVENT']

export default function BudgetsScreen() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const budgets = useBudgets(householdId)
  const lists = useLists(householdId)
  const events = useEvents(householdId)
  const create = useCreateBudget(householdId ?? '')
  const patch = usePatchBudget(householdId ?? '')
  const del = useDeleteBudget(householdId ?? '')

  const [addOpen, setAddOpen] = useState(false)
  const [scope, setScope] = useState<BudgetScope>('WEEKLY')
  const [amount, setAmount] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)

  const add = async () => {
    const cents = dollarsToCents(amount)
    if (cents === null || cents <= 0) return Alert.alert('Enter a valid amount')
    if ((scope === 'TRIP' || scope === 'EVENT') && !targetId) {
      return Alert.alert('Pick a target', `Pick a ${scope === 'TRIP' ? 'list' : 'event'} for this budget.`)
    }
    try {
      await create.mutateAsync({
        scope,
        amountCents: cents,
        listId: scope === 'TRIP' ? targetId : null,
        eventId: scope === 'EVENT' ? targetId : null,
      })
      setAmount('')
      setTargetId(null)
      setScope('WEEKLY')
      setAddOpen(false)
    } catch (e: unknown) {
      Alert.alert('Could not set budget', e instanceof Error ? e.message : '')
    }
  }

  const renderBudget = (b: Budget) => {
    const spent = b.spendCents ?? 0
    const pct = b.amountCents > 0 ? Math.min(100, Math.round((spent / b.amountCents) * 100)) : 0
    const over = spent > b.amountCents
    return (
      <Card key={b.id}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Subtitle>
              {b.scope.charAt(0) + b.scope.slice(1).toLowerCase()} budget
            </Subtitle>
            <Caption muted>
              {b.scope === 'TRIP' && b.list ? `List: ${b.list.name}` : ''}
              {b.scope === 'EVENT' && b.event ? `Event: ${b.event.name}` : ''}
              {b.scope === 'WEEKLY' ? 'Last 7 days' : ''}
              {b.scope === 'MONTHLY' ? 'This calendar month' : ''}
            </Caption>
          </View>
          <Pressable onPress={() => del.mutate(b.id)} hitSlop={8} accessibilityLabel="Remove budget">
            <Trash2 color={BRAND.red} size={16} />
          </Pressable>
        </View>

        <View style={styles.barWrap}>
          <View style={[styles.bar, { width: `${pct}%`, backgroundColor: over ? BRAND.red : BRAND.green }]} />
        </View>
        <View style={styles.barLegend}>
          <Body>{formatCents(spent)} spent</Body>
          <Caption muted style={{ color: over ? BRAND.red : BRAND.textSecondary }}>
            of {formatCents(b.amountCents)} · {pct}%
          </Caption>
        </View>
      </Card>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header
        title="Budgets"
        subtitle={activeHousehold?.name ?? ''}
        right={
          <Pressable onPress={() => setAddOpen(true)} hitSlop={12} accessibilityLabel="Set a budget">
            <View style={styles.iconBtn}>
              <Plus color={BRAND.green} size={20} />
            </View>
          </Pressable>
        }
      />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {budgets.isLoading ? (
        <LoadingState label="Loading budgets…" />
      ) : (budgets.data?.budgets.length ?? 0) === 0 ? (
        <EmptyState
          title="No budgets yet"
          hint="Set a trip, weekly, monthly, or event budget. We'll track spend against it."
          action={<Button label="Set a budget" onPress={() => setAddOpen(true)} />}
        />
      ) : (
        <FlatList
          data={budgets.data?.budgets ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          ListHeaderComponent={<SectionHeader title={`${budgets.data?.budgets.length ?? 0} budgets`} />}
          renderItem={({ item }) => renderBudget(item)}
        />
      )}

      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Set a budget</Subtitle>

            <Text style={[styles.label, { marginTop: SPACING.md }]}>Scope</Text>
            <View style={styles.chipsRow}>
              {SCOPES.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => { setScope(s); setTargetId(null) }}
                  style={[styles.chip, scope === s && styles.chipActive]}
                >
                  <Text style={{ color: scope === s ? '#fff' : BRAND.textSecondary }}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {(scope === 'TRIP' || scope === 'EVENT') && (
              <>
                <Text style={[styles.label, { marginTop: SPACING.md }]}>
                  {scope === 'TRIP' ? 'List' : 'Event'}
                </Text>
                <View style={styles.chipsRow}>
                  {(scope === 'TRIP' ? lists.data?.lists ?? [] : events.data?.events ?? []).map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => setTargetId(t.id)}
                      style={[styles.chip, targetId === t.id && styles.chipActive]}
                    >
                      <Text style={{ color: targetId === t.id ? '#fff' : BRAND.textSecondary }}>
                        {t.name}
                      </Text>
                    </Pressable>
                  ))}
                  {(scope === 'TRIP' ? lists.data?.lists.length : events.data?.events.length) === 0 && (
                    <Caption muted>No {scope === 'TRIP' ? 'lists' : 'events'} yet.</Caption>
                  )}
                </View>
              </>
            )}

            <Text style={[styles.label, { marginTop: SPACING.md }]}>Amount (USD)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="50.00"
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
    marginBottom: SPACING.sm,
  },
  barWrap: {
    height: 8,
    backgroundColor: BRAND.bgSubtle,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: SPACING.sm,
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
  barLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
