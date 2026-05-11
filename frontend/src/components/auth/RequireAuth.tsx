import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { useAuthStore } from "@/stores/auth"

export function RequireAuth({ children }: { children: ReactNode }) {
  const profile = useAuthStore((s) => s.profile)
  const location = useLocation()

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
