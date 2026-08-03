import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  WelcomeScreen,
  MobileInputScreen,
  OtpInputScreen,
  OtpVerifiedScreen,
} from '../../user/components/onboarding'
import { AUTH_ROUTES, USER_ROUTES } from '../../../config/routes'
import { useAuthStore } from '../../../lib/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1) // 1: Welcome, 2: Mobile, 3: OTP, 4: Verified
  const [phoneNumber, setPhoneNumber] = useState('98765 43210')

  const handleGuestAccess = () => {
    useAuthStore.getState().setSession({
      user: { name: 'Guest User', phone: 'Guest Mode' },
      accessToken: 'demo-krozenda-guest-token-' + Date.now(),
    })
    navigate(USER_ROUTES.DASHBOARD)
  }

  const handleMobileSubmit = (num) => {
    if (num) setPhoneNumber(num)
    setCurrentStep(3)
  }

  const handleVerificationSuccess = () => {
    useAuthStore.getState().setSession({
      user: { name: 'Rahul Sharma', phone: phoneNumber || '9876543210' },
      accessToken: 'demo-krozenda-user-token-' + Date.now(),
    })
    setCurrentStep(4)
  }

  const handleCompleteFlow = () => {
    useAuthStore.getState().setSession({
      user: { name: 'Rahul Sharma', phone: phoneNumber || '9876543210' },
      accessToken: 'demo-krozenda-user-token-' + Date.now(),
    })
    navigate(USER_ROUTES.DASHBOARD)
  }

  return (
    <div className="w-full min-h-screen bg-slate-100/70 flex flex-col justify-center items-center">
      {currentStep === 1 && (
        <WelcomeScreen
          onNext={() => setCurrentStep(2)}
          onGuest={handleGuestAccess}
        />
      )}

      {currentStep === 2 && (
        <MobileInputScreen
          onBack={() => setCurrentStep(1)}
          onNext={handleMobileSubmit}
          onSwitchToRegister={() => navigate(AUTH_ROUTES.REGISTER)}
        />
      )}

      {currentStep === 3 && (
        <OtpInputScreen
          phoneNumber={phoneNumber}
          onBack={() => setCurrentStep(2)}
          onVerifySuccess={handleVerificationSuccess}
        />
      )}

      {currentStep === 4 && (
        <OtpVerifiedScreen onNext={handleCompleteFlow} />
      )}
    </div>
  )
}
