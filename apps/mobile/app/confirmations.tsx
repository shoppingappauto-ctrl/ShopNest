/**
 * Confirmations screen — pending photo confirmations list, approve / reject /
 * substitute decisions. Realtime-updated (useHouseholdConfirmations polls
 * every 15s as a fallback when the socket is unavailable).
 */

import React, { useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, X, RefreshCw } from 'lucide-react-native'
import type { ConfirmationRequest } from '@shopnest/shared'
import {
  useDecideConfirmation,
  useHouseholdConfirmations,
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
  Subtitle,
  Title,
} from '../components/ui'
import { ConnectionBanner } from '../components/connection-banner'
import { useRealtime } from '../lib/realtime'

export default function ConfirmationsScreen() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  // Pending first, then recently decided (so the user sees resolutions too).
  const pending = useHouseholdConfirmations(householdId, 'PENDING')
  const recent = useHouseholdConfirmations(householdId)
  const decide = useDecideConfirmation(householdId ?? '')

  const [subFor, setSubFor] = useState<ConfirmationRequest | null>(null)
  const [subName, setSubName] = useState('')

  const merged: ConfirmationRequest[] = [
    ...(pending.data?.requests ?? []),
    ...(recent.data?.requests ?? []).filter((r) => r.status !== 'PENDING'),
  ].slice(0, 30)

  const approve = (r: ConfirmationRequest) => {
    decide.mutate({ id: r.id, req: { action: 'decide', decision: 'APPROVED', version: r.version } })
  }
  const reject = (r: ConfirmationRequest) => {
    decide.mutate({ id: r.id, req: { action: 'decide', decision: 'REJECTED', version: r.version } })
  }
  const openSub = (r: ConfirmationRequest) => {
    setSubFor(r)
    setSubName('')
  }
  const submitSub = () => {
    if (!subFor || !subName.trim()) return
    decide.mutate(
      {
        id: subFor.id,
        req: {
          action: 'decide',
          decision: 'SUBSTITUTE_SUGGESTED',
          substituteName: subName.trim(),
          version: subFor.version,
        },
      },
      { onSuccess: () => { setSubFor(null); setSubName('') } },
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header title="Confirmations" subtitle={activeHousehold?.name ?? ''} />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {pending.isLoading && recent.isLoading ? (
        <LoadingState label="Loading confirmations…" />
      ) : merged.length === 0 ? (
        <EmptyState
          title="No confirmations"
          hint="When a shopper asks “is this the right product?” it'll appear here."
        />
      ) : (
        <FlatList
          data={merged}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          renderItem={({ item: r }) => (
            <Card>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: r.requestedBy?.avatarColor ?? BRAND.green }]}>
                  <Text style={styles.avatarText}>
                    {r.requestedBy?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Subtitle>{r.item?.name ?? 'Item'}</Subtitle>
                  <Caption muted>
                    Asked by {r.requestedBy?.name ?? 'someone'} ·{' '}
                    {new Date(r.createdAt).toLocaleString()}
                  </Caption>
                </View>
                <Pill
                  label={r.status.toLowerCase().replace(/_/g, ' ')}
                  backgroundColor={
                    r.status === 'PENDING'
                      ? '#fff7ed'
                      : r.status === 'APPROVED'
                        ? '#f0fdf4'
                        : r.status === 'REJECTED'
                          ? '#fef2f2'
                          : BRAND.bgSubtle
                  }
                  color={
                    r.status === 'PENDING'
                      ? '#9a3412'
                      : r.status === 'APPROVED'
                        ? BRAND.green
                        : r.status === 'REJECTED'
                          ? BRAND.red
                          : BRAND.textSecondary
                  }
                />
              </View>

              {r.photo?.dataUrl ? (
                <Image
                  source={{ uri: r.photo.dataUrl }}
                  style={styles.photo}
                  accessibilityLabel={`Photo for ${r.item?.name ?? 'item'}`}
                />
              ) : null}

              {r.note ? <Body style={{ marginTop: SPACING.sm }}>{r.note}</Body> : null}

              {r.decisionNote ? (
                <Caption muted style={{ marginTop: SPACING.sm }}>
                  Decision: {r.decisionNote}
                </Caption>
              ) : null}
              {r.substituteName ? (
                <Caption muted style={{ marginTop: 4 }}>
                  Suggested substitute: {r.substituteName}
                </Caption>
              ) : null}

              {r.status === 'PENDING' && (
                <View style={styles.actions}>
                  <Button
                    label="Approve"
                    size="sm"
                    onPress={() => approve(r)}
                    loading={decide.isPending}
                    icon={<Check color="#fff" size={16} />}
                  />
                  <Button
                    label="Reject"
                    size="sm"
                    variant="outline"
                    danger
                    onPress={() => reject(r)}
                    loading={decide.isPending}
                    icon={<X color={BRAND.red} size={16} />}
                  />
                  <Button
                    label="Substitute"
                    size="sm"
                    variant="outline"
                    onPress={() => openSub(r)}
                  />
                </View>
              )}
            </Card>
          )}
        />
      )}

      <Modal visible={!!subFor} animationType="slide" transparent onRequestClose={() => setSubFor(null)}>
        <View style={styles.modalRoot}>
          <Card style={{ margin: SPACING.lg }}>
            <Subtitle>Suggest a substitute</Subtitle>
            <Caption muted>For: {subFor?.item?.name ?? 'this item'}</Caption>
            <TextInput
              style={styles.input}
              value={subName}
              onChangeText={setSubName}
              placeholder="e.g. smaller size of the same brand"
              placeholderTextColor={BRAND.textMuted}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
              <Button label="Cancel" variant="ghost" onPress={() => setSubFor(null)} style={{ flex: 1 }} />
              <Button label="Suggest" onPress={submitSub} loading={decide.isPending} style={{ flex: 1 }} />
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    backgroundColor: BRAND.bgSubtle,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: BRAND.white,
    color: BRAND.textPrimary,
    fontSize: 16,
    marginTop: SPACING.md,
  },
})
