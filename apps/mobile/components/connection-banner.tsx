/**
 * Connection / offline-queue banner — shown at the top of every tab screen.
 *
 * Three states:
 *  • 'live'      → hidden (no banner)
 *  • 'connecting' → a subtle "Connecting…" bar
 *  • 'offline'   → a "You're offline — changes saved locally" bar with a
 *                  pending-mutation count badge
 */

import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Wifi, WifiOff, CloudUpload } from 'lucide-react-native'
import type { ConnectionStatus } from '../lib/realtime'
import { BRAND, RADIUS, SPACING, TYPO } from '../lib/theme'

export function ConnectionBanner({
  status,
  queueCount,
}: {
  status: ConnectionStatus
  queueCount: number
}) {
  if (status === 'live' && queueCount === 0) return null

  let bg = BRAND.greenSoft
  let fg = BRAND.greenDark
  let icon = <Wifi color={fg} size={14} />
  let label = 'Connecting…'

  if (status === 'offline' || queueCount > 0) {
    bg = '#fff7ed'
    fg = '#9a3412'
    icon = queueCount > 0 ? <CloudUpload color={fg} size={14} /> : <WifiOff color={fg} size={14} />
    label =
      queueCount > 0
        ? `Offline — ${queueCount} change${queueCount === 1 ? '' : 's'} queued to sync`
        : 'Offline — changes saved locally'
  } else if (status === 'connecting') {
    bg = BRAND.greenSoft
    fg = BRAND.greenDark
  }

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      {icon}
      <Text style={[TYPO.caption, { color: fg, fontWeight: '600', marginLeft: SPACING.xs }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth ? 0 : 0,
  },
})
