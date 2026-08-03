import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

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
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  )
}
