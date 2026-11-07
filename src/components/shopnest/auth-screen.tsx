'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, ListChecks, Store, Zap, UserPlus } from 'lucide-react'
import { useLogin, useRegister } from '@/lib/shopnest/hooks'
import { api } from '@/lib/shopnest/client'
import { ShopNestWordmark } from '@/components/shopnest/logo'

type DemoInfo = {
  householdId: string
  accounts: { email: string; name: string; password: string; role: string }[]
}

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const login = useLogin()
  const register = useRegister()
  const [demoInfo, setDemoInfo] = useState<DemoInfo | null>(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  // invite deep link: /?invite=SN-XXXXXX
  useEffect(() => {
    const url = new URL(window.location.href)
    const invite = url.searchParams.get('invite')
    if (invite && /^SN-[A-Z0-9]{6}$/i.test(invite)) {
      setInviteCode(invite.toUpperCase())
      window.localStorage.setItem('shopnest_pending_invite', invite.toUpperCase())
      url.searchParams.delete('invite')
      window.history.replaceState(null, '', url.toString())
    }
  }, [])

  const loadDemo = async () => {
    setDemoLoading(true)
    try {
      const res = await api<{ demo: DemoInfo }>('/api/demo/seed', { method: 'POST', noOfflineQueue: true })
      setDemoInfo(res.demo)
      await api('/api/auth/login', {
        method: 'POST',
        body: { email: res.demo.accounts[0].email, password: res.demo.accounts[0].password },
        noOfflineQueue: true,
      })
      onAuthed()
    } catch (err) {
      console.error(err)
    } finally {
      setDemoLoading(false)
    }
  }

  const busy = login.isPending || register.isPending || demoLoading

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary/8 via-background to-background">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 gap-8">
        <div className="text-center space-y-3 max-w-md">
          <div className="flex justify-center">
            <ShopNestWordmark size={52} />
          </div>
          <p className="text-lg text-muted-foreground font-medium">Your Family. Your Shopping. One Place.</p>
          <p className="text-sm text-muted-foreground">
            Live shared lists for couples, families, roommates and caregivers — at home and in the store.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Badge variant="secondary" className="gap-1"><ListChecks className="h-3 w-3" /> Live sync</Badge>
            <Badge variant="secondary" className="gap-1"><Store className="h-3 w-3" /> Multi-store</Badge>
            <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Households</Badge>
          </div>
        </div>

        {inviteCode && (
          <div className="w-full max-w-md rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary shrink-0" />
            <span>
              You&apos;ve been invited with code <strong className="font-mono tracking-widest">{inviteCode}</strong>. Sign in or
              create an account, then use <em>Household → Join with code</em>.
            </span>
          </div>
        )}

        <Card className="w-full max-w-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Get started</CardTitle>
            <CardDescription>Create an account or sign in to your household.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    login.mutate(
                      {
                        email: String(fd.get('email') ?? ''),
                        password: String(fd.get('password') ?? ''),
                      },
                      { onSuccess: onAuthed }
                    )
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" name="email" type="email" autoComplete="email" placeholder="you@family.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-password">Password</Label>
                    <Input id="si-password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={busy}>
                    {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const fd = new FormData(e.currentTarget)
                    register.mutate(
                      {
                        name: String(fd.get('name') ?? ''),
                        email: String(fd.get('email') ?? ''),
                        password: String(fd.get('password') ?? ''),
                      },
                      { onSuccess: onAuthed }
                    )
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Your name</Label>
                    <Input id="su-name" name="name" autoComplete="name" placeholder="Alex" required minLength={2} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" autoComplete="email" placeholder="you@family.com" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Password</Label>
                    <Input
                      id="su-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                    />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={busy}>
                    {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    The first account created becomes the platform administrator.
                  </p>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or try the demo</span></div>
            </div>

            <Button variant="outline" className="w-full h-11 gap-2" onClick={loadDemo} disabled={busy}>
              {demoLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Explore ShopNest with demo data
            </Button>
            {demoInfo && (
              <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">Demo household “The Demo Family” seeded</p>
                <p>Alex (owner): alex@demo.shopnest · Sam (member): sam@demo.shopnest</p>
                <p>Password for both: shopnest123 — sign in as each in a separate browser window to watch changes sync live.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground max-w-sm text-center">
          By continuing you agree to ShopNest&apos;s terms and privacy policy. This sandbox build does not
          process payments or send email.
        </p>
      </main>
    </div>
  )
}
