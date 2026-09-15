import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { AUTH_ROUTES } from '../../config/routes'

export default function AuthRoutes() {
  return (
    <Routes>
      <Route index element={<LoginPage />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="welcome" element={<LoginPage />} />
      {/* RegisterPage used to live here as a separate email/password signup
          wizard, but it never called the backend — every step fabricated a
          fake session locally. The real (and only) registration path is
          LoginPage's mobile-OTP flow, which auto-registers new numbers via
          POST /auth/verify-otp, so both aliases now land there instead of
          maintaining a second, disconnected flow. */}
      <Route path="register" element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
      <Route path="signup" element={<Navigate to={AUTH_ROUTES.LOGIN} replace />} />
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
