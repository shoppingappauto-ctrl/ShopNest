'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Check, X, Sparkles } from 'lucide-react'
import { api } from '@/lib/shopnest/client'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { PLUS_PRICE_PER_MONTH } from '@/lib/shopnest/constants'

const FREE_FEATURES = [
  'Shared household lists',
  'Real-time sync',
  'Multiple stores',
  'Basic photos & item discussions',
  'Favorites & recurring essentials',
  'Shopping history',
]

const PLUS_FEATURES = [
  'Everything in Free',
  'Advanced reminders',
  'Expanded photo & receipt storage',
  'Warranty tracking & expiry alerts',
  'Advanced event planning',
  'Barcode productivity features',
  'Household shopping insights',
  'Premium templates',
]

export function PlusDialog({
  open,
  onOpenChange,
  householdId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  householdId: string
}) {
  const [checking, setChecking] = useState(false)

  const attemptUpgrade = () => {
    setChecking(true)
    api<{ message?: string }>(`/api/households/${householdId}/plan`, {
      method: 'POST',
      noOfflineQueue: true,
    })
      .then(() => {
        toast({ description: 'ShopNest Plus is active for this household!' })
        onOpenChange(false)
      })
      .catch((err: { status?: number; message?: string }) => {
        // 402: payments disabled in this build — show honest notice
        toast({
          description:
            err.message ??
            'Payments are not enabled in this build. Billing will be activated after app-store and Stripe credentials are configured and approved.',
        })
      })
      .finally(() => setChecking(false))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto scrollbar-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" /> ShopNest Plus
          </DialogTitle>
          <DialogDescription>
            ${PLUS_PRICE_PER_MONTH}/month per household — cancel anytime. The free plan stays genuinely useful forever.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <p className="font-semibold mb-2">Free</p>
            <ul className="space-y-1.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="text-sm flex items-start gap-1.5 text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-primary p-4 relative">
            <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              RECOMMENDED
            </span>
            <p className="font-semibold mb-2">Plus</p>
            <ul className="space-y-1.5">
              {PLUS_FEATURES.map((f, idx) => (
                <li key={f} className={cn('text-sm flex items-start gap-1.5', idx === 0 ? 'font-medium' : 'text-muted-foreground')}>
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-muted-foreground flex items-start gap-1.5">
          <X className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
          Payments are disabled in this sandbox build. Subscriptions require native in-app billing (Apple/Google) or Stripe,
          activated with explicit owner approval before any charge.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button onClick={attemptUpgrade} disabled={checking} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Upgrade for ${PLUS_PRICE_PER_MONTH}/mo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
