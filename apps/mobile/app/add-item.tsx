/**
 * Add item screen — name + qty + unit + (optional) list + (optional) store.
 *
 * Voice input: text + parseVoiceCommand (from @shopnest/shared) is the
 * ALWAYS-AVAILABLE path. A clearly-marked "Voice (native)" button tries the
 * optional native speech module (see lib/voice-native.ts) — when no module is
 * installed, the button is disabled and the text path is used.
 *
 * The parser turns "add 2 gallons of milk to Walmart" into:
 *   { name: "Milk", quantity: 2, unit: "gal", storeName: "Walmart", confidence: "high" }
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, Mic, Sparkles } from 'lucide-react-native'
import { parseVoiceCommand, UNITS, type ParsedVoiceItem, type Unit } from '@shopnest/shared'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api-client'
import {
  useCreateItem,
  useLists,
  useStores,
} from '../lib/hooks'
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'
import {
  Body,
  Button,
  Card,
  Caption,
  Header,
  LoadingState,
  Pill,
  SectionHeader,
  Subtitle,
} from '../components/ui'
import { ConnectionBanner } from '../components/connection-banner'
import { useRealtime } from '../lib/realtime'
import { useVoiceInput } from '../lib/voice-native'

export default function AddItemScreen() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const params = useLocalSearchParams<{
    name?: string
    nameBn?: string
    qty?: string
    unit?: string
    listId?: string
  }>()

  const householdId = activeHousehold?.id ?? null
  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)
  const lists = useLists(householdId)
  const stores = useStores(householdId)
  const createItem = useCreateItem()

  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<ParsedVoiceItem | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState<string>('pc')
  const [listId, setListId] = useState<string | null>(params.listId ?? null)
  const [storeName, setStoreName] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const voice = useVoiceInput()

  // Prefill from URL params (e.g. coming from the catalog or essentials chip).
  useEffect(() => {
    if (params.name) setName(params.name)
    if (params.qty) setQty(params.qty)
    if (params.unit) setUnit(params.unit)
  }, [params.name, params.qty, params.unit])

  // When parsed from voice, prefill the visible fields.
  useEffect(() => {
    if (!parsed) return
    setName(parsed.name)
    setQty(String(parsed.quantity))
    setUnit(parsed.unit)
    setStoreName(parsed.storeName)
  }, [parsed])

  const handleParse = (text: string) => {
    setTranscript(text)
    const p = parseVoiceCommand(text)
    setParsed(p)
    if (!p) {
      // No structured parse — use the raw text as the name.
      setName(text.trim())
    }
  }

  const submit = async () => {
    if (!name.trim()) return Alert.alert('Enter a name')
    if (!listId) return Alert.alert('Pick a list')
    const store = (stores.data?.stores ?? []).find(
      (s) => s.name.toLowerCase() === (storeName ?? '').toLowerCase(),
    )
    setSaving(true)
    try {
      await createItem.mutateAsync({
        listId,
        householdId: householdId ?? '',
        req: {
          name: name.trim(),
          nameBn: params.nameBn ?? null,
          quantity: Number(qty) || 1,
          unit: unit as Unit,
          storeId: store?.id ?? null,
        },
      })
      router.back()
    } catch (e: unknown) {
      Alert.alert('Could not add item', e instanceof Error ? e.message : '')
    } finally {
      setSaving(false)
    }
  }

  if (!householdId) {
    return <LoadingState label="No active household" />
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}
      contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
    >
      <Header title="Add item" subtitle={activeHousehold?.name} />
      <ConnectionBanner status={status} queueCount={queueCount} />

      {/* Voice input box */}
      <Card>
        <View style={styles.voiceHeader}>
          <Mic color={BRAND.green} size={18} />
          <Subtitle>Voice or text entry</Subtitle>
        </View>
        <Caption muted style={{ marginTop: 4 }}>
          Try: “add 2 gallons of milk to Walmart” or “5 kilos basmati rice”.
        </Caption>
        <TextInput
          style={[styles.input, { marginTop: SPACING.sm, minHeight: 60 }]}
          value={transcript}
          onChangeText={handleParse}
          placeholder="Type or paste a phrase…"
          placeholderTextColor={BRAND.textMuted}
          multiline
        />
        <View style={styles.voiceRow}>
          <Button
            label={voice.state === 'listening' ? 'Listening…' : 'Voice (native)'}
            size="sm"
            variant="outline"
            disabled={!voice.nativeAvailable() || voice.state === 'listening'}
            onPress={voice.startListening}
            icon={<Mic color={voice.nativeAvailable() ? BRAND.green : BRAND.textMuted} size={16} />}
          />
          {voice.state === 'unsupported' && (
            <Caption muted style={{ flex: 1, marginLeft: SPACING.sm }}>
              Native speech module not installed. Text + parser works everywhere.
            </Caption>
          )}
          {voice.state === 'listening' && (
            <Button label="Stop" size="sm" variant="ghost" onPress={voice.stopListening} />
          )}
        </View>
        {parsed && (
          <View style={styles.parsedBox}>
            <View style={styles.parsedHeader}>
              <Check color={BRAND.green} size={14} />
              <Caption style={{ color: BRAND.greenDark, fontWeight: '600', marginLeft: 4 }}>
                Parsed · confidence: {parsed.confidence}
              </Caption>
            </View>
            <View style={styles.parsedChips}>
              <Pill label={`name: ${parsed.name}`} />
              <Pill label={`${parsed.quantity} ${parsed.unit}`} />
              {parsed.storeName && <Pill label={`store: ${parsed.storeName}`} />}
            </View>
          </View>
        )}
      </Card>

      <SectionHeader title="Fields" />
      <Card>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Milk"
          placeholderTextColor={BRAND.textMuted}
        />

        <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Qty</Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Unit</Text>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, flexWrap: 'wrap' }]}>
              {UNITS.map((u) => (
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

        <Text style={[styles.label, { marginTop: SPACING.md }]}>Store (optional)</Text>
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
      </Card>

      <SectionHeader title="Add to list" />
      <Card style={{ padding: 0 }}>
        {(lists.data?.lists ?? []).length === 0 && (
          <Caption muted style={{ padding: SPACING.lg }}>
            No lists yet — create one on the Lists tab first.
          </Caption>
        )}
        {(lists.data?.lists ?? []).map((l) => (
          <Pressable
            key={l.id}
            onPress={() => setListId(l.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: SPACING.md,
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.md,
              borderBottomWidth: 1,
              borderBottomColor: BRAND.border,
            }}
          >
            <View style={[styles.radio, listId === l.id && styles.radioActive]} />
            <Text style={{ fontSize: 22 }}>{l.emoji ?? '🛒'}</Text>
            <View style={{ flex: 1 }}>
              <Body>{l.name}</Body>
              <Caption muted>{l.store?.name ?? 'No default store'}</Caption>
            </View>
          </Pressable>
        ))}
      </Card>

      <Button
        label="Add to list"
        onPress={submit}
        loading={saving || createItem.isPending}
        disabled={!listId}
        style={{ marginTop: SPACING.lg }}
        icon={<Sparkles color="#fff" size={18} />}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  parsedBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: BRAND.greenTint,
    borderRadius: RADIUS.md,
  },
  parsedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  parsedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
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
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BRAND.grayLight,
  },
  radioActive: {
    borderColor: BRAND.green,
    backgroundColor: BRAND.green,
  },
})
