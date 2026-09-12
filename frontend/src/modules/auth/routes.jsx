import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AUTH_ROUTES } from '../../config/routes'

export default function AuthRoutes() {
  return (
    <Routes>
      <Route index element={<LoginPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="welcome" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="signup" element={<RegisterPage />} />
      <Route path="mobile" element={<LoginPage />} />
      <Route path="otp" element={<LoginPage />} />
      <Route path="verified" element={<LoginPage />} />
      {/* Absolute path — a relative "login" here re-resolves against the
          already-unmatched URL on every render of an unmatched deep link
          (e.g. /auth/foo/bar), appending itself indefinitely instead of
          landing on /auth/login. */}
      <Route path="*" element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
    </Routes>
  )
}
