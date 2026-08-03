import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Screen1Welcome,
  Screen2MobileInput,
  Screen3OtpInput,
  Screen4OtpVerified,
} from '../../user/components/onboarding'
import { AUTH_ROUTES, USER_ROUTES } from '../../../config/routes'

export function LoginPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1) // 1: Welcome, 2: Mobile, 3: OTP, 4: Verified
  const [phoneNumber, setPhoneNumber] = useState('98765 43210')

  const handleMobileSubmit = (num) => {
    if (num) setPhoneNumber(num)
    setCurrentStep(3)
  }

  const handleVerificationSuccess = () => {
    setCurrentStep(4)
  }

  const handleCompleteFlow = () => {
    navigate(USER_ROUTES.DASHBOARD)
  }

  return (
    <div className="w-full min-h-screen bg-slate-900">
      {currentStep === 1 && (
        <Screen1Welcome
          onNext={() => setCurrentStep(2)}
          onGuest={() => navigate(USER_ROUTES.DASHBOARD)}
        />
      )}

      {currentStep === 2 && (
        <Screen2MobileInput
          onBack={() => setCurrentStep(1)}
          onNext={handleMobileSubmit}
          onSwitchToRegister={() => navigate(AUTH_ROUTES.REGISTER)}
        />
      )}

      {currentStep === 3 && (
        <Screen3OtpInput
          phoneNumber={phoneNumber}
          onBack={() => setCurrentStep(2)}
          onVerifySuccess={handleVerificationSuccess}
        />
      )}

      {currentStep === 4 && (
        <Screen4OtpVerified onNext={handleCompleteFlow} />
      )}
    </div>
  )
}

export default LoginPage
