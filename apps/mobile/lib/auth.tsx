/**
 * ShopNest Mobile — auth context provider.
 *
 * Loads the bearer token from secure store on mount, calls /api/auth/me to
 * hydrate the current user and household list, and exposes login/register/
 * logout actions that all keep the secure-store token in sync.
 *
 * Per SECURITY.md §1: native clients use the Bearer token in the Authorization
 * header (the web app's HttpOnly cookie does not apply to native clients).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Me, MyHousehold } from '@shopnest/shared'
import { api, ApiClientError } from './api-client'
import {
  getActiveHouseholdId,
  getToken,
  setActiveHouseholdId,
  setToken,
} from './secure-storage'
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
} from '@shopnest/shared'

type AuthContextValue = {
  user: Me | null
  households: MyHousehold[]
  activeHousehold: MyHousehold | null
  setActiveHousehold: (id: string) => void
  login: (req: LoginRequest) => Promise<void>
  register: (req: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
  /** Force a re-fetch of /api/auth/me (used by realtime events). */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [households, setHouseholds] = useState<MyHousehold[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMe = useCallback(async () => {
    const token = await getToken()
    if (!token) {
      setUser(null)
      setHouseholds([])
      setActiveId(null)
      setLoading(false)
      return
    }
    try {
      const data = await api<MeResponse>('/api/auth/me')
      setUser(data.user)
      setHouseholds(data.households ?? [])
      // Pick active household: saved id if still a member, else first.
      const saved = await getActiveHouseholdId()
      if (saved && data.households.some((h) => h.id === saved)) {
        setActiveId(saved)
      } else if (data.households.length > 0) {
        setActiveId(data.households[0].id)
      } else {
        setActiveId(null)
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        await setToken(null)
        await setActiveHouseholdId(null)
      }
      setUser(null)
      setHouseholds([])
      setActiveId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  const setActiveHousehold = useCallback((id: string) => {
    setActiveId(id)
    void setActiveHouseholdId(id)
  }, [])

  const login = useCallback(
    async (req: LoginRequest) => {
      const res = await api<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: req,
        noOfflineQueue: true,
      })
      await setToken(res.token)
      await loadMe()
    },
    [loadMe],
  )

  const register = useCallback(
    async (req: RegisterRequest) => {
      const res = await api<RegisterResponse>('/api/auth/register', {
        method: 'POST',
        body: req,
        noOfflineQueue: true,
      })
      await setToken(res.token)
      await loadMe()
    },
    [loadMe],
  )

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', noOfflineQueue: true })
    } catch {
      // swallow — we clear the local token regardless
    }
    await setToken(null)
    await setActiveHouseholdId(null)
    setUser(null)
    setHouseholds([])
    setActiveId(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      households,
      activeHousehold: households.find((h) => h.id === activeId) ?? null,
      setActiveHousehold,
      login,
      register,
      logout,
      loading,
      refresh: loadMe,
    }),
    [user, households, activeId, setActiveHousehold, login, register, logout, loading, loadMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
