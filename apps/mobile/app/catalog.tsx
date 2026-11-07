/**
 * Specialty catalog screen — search Bangla / halal / South Asian / household
 * staples. Tapping an entry navigates to /add-item with prefilled name + qty.
 *
 * Halal tags are informational (retailer-style descriptions) — the API never
 * certifies anything.
 */

import React, { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Search } from 'lucide-react-native'
import {
  CATALOG_SECTIONS,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  STORE_CATEGORY_EMOJI,
} from '@shopnest/shared'
import { useCatalogSearch } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'
import {
  Body,
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

export default function CatalogScreen() {
  const { activeHousehold } = useAuth()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const householdId = activeHousehold?.id ?? null

  const { status, queueCount } = useRealtime(activeHousehold ? [activeHousehold.id] : [], !!activeHousehold)

  const [q, setQ] = useState('')
  const [section, setSection] = useState<string>('ALL')

  const search = useCatalogSearch(householdId, { q, section })

  const catalog = search.data?.catalog ?? []
  const householdProducts = search.data?.household ?? []

  const sections = useMemo(() => CATALOG_SECTIONS, [])

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.bgPage, paddingTop: insets.top }}>
      <Header title="Specialty catalog" subtitle="Bangla · halal · South Asian" />
      <ConnectionBanner status={status} queueCount={queueCount} />

      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Search color={BRAND.textMuted} size={16} />
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Search ilish, halal beef, dal…"
            placeholderTextColor={BRAND.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.sectionRow}>
        <Pressable
          onPress={() => setSection('ALL')}
          style={[styles.chip, section === 'ALL' && styles.chipActive]}
        >
          <Text style={{ color: section === 'ALL' ? '#fff' : BRAND.textSecondary }}>All</Text>
        </Pressable>
        {sections.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setSection(s.key)}
            style={[styles.chip, section === s.key && styles.chipActive]}
          >
            <Text style={{ color: section === s.key ? '#fff' : BRAND.textSecondary, fontSize: 12 }}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {search.isLoading ? (
        <LoadingState label="Searching…" />
      ) : (
        <FlatList
          data={[{ kind: 'catalog' as const, items: catalog }, { kind: 'hh' as const, items: householdProducts }]}
          keyExtractor={(item, i) => `${item.kind}-${i}`}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => {
            if (item.kind === 'hh' && item.items.length === 0) return null
            return (
              <View>
                <SectionHeader title={item.kind === 'catalog' ? 'Catalog' : 'Your saved products'} />
                {item.items.length === 0 && (
                  <Caption muted style={{ paddingHorizontal: SPACING.sm }}>
                    {q ? `No matches for “${q}”.` : 'Nothing here yet.'}
                  </Caption>
                )}
                {item.items.map((p) => (
                  <Pressable
                    key={p.name + (p.nameBn ?? '')}
                    onPress={() =>
                      router.push({
                        pathname: '/add-item',
                        params: {
                          name: p.name,
                          nameBn: p.nameBn ?? '',
                          qty: String(p.defaultQty),
                          unit: p.unit,
                        },
                      })
                    }
                  >
                    <Card style={styles.entry}>
                      <View style={styles.row}>
                        <Text style={styles.emoji}>{CATEGORY_EMOJI[p.category] ?? '🛒'}</Text>
                        <View style={{ flex: 1 }}>
                          <Subtitle>{p.name}</Subtitle>
                          {p.nameBn && <Caption muted>{p.nameBn}</Caption>}
                          <Caption muted>
                            {CATEGORY_LABEL[p.category] ?? p.category} · {p.defaultQty} {p.unit}
                          </Caption>
                          {p.aliases && p.aliases.length > 0 && (
                            <View style={[styles.row, { marginTop: 4, gap: 4 }]}>
                              {p.aliases.slice(0, 3).map((a) => (
                                <Pill key={a} label={a} backgroundColor={BRAND.bgSubtle} color={BRAND.textSecondary} />
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    height: 44,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: BRAND.white,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: BRAND.textPrimary,
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.white,
  },
  chipActive: {
    backgroundColor: BRAND.green,
    borderColor: BRAND.green,
  },
  entry: {
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  emoji: { fontSize: 22, marginTop: 2 },
})
