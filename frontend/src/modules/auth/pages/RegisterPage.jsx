import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignupScreen1Mobile } from '../components/signup/SignupScreen1Mobile'
import { SignupScreen2Otp } from '../components/signup/SignupScreen2Otp'
import { SignupScreen3Password } from '../components/signup/SignupScreen3Password'
import { SignupScreen4Email } from '../components/signup/SignupScreen4Email'
import { SignupScreen5Success } from '../components/signup/SignupScreen5Success'
import { AUTH_ROUTES, USER_ROUTES } from '../../../config/routes'

export function RegisterPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [phoneNumber, setPhoneNumber] = useState('98765 43210')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const handleMobileSubmit = (num) => {
    if (num) setPhoneNumber(num)
    setCurrentStep(2)
  }

  const handleOtpVerified = () => {
    setCurrentStep(3)
  }

  const handlePasswordSet = (pwd) => {
    if (pwd) setPassword(pwd)
    setCurrentStep(4)
  }

  const handleEmailSubmitted = (mail) => {
    if (mail) setEmail(mail)
    setCurrentStep(5)
  }

  const handleSkipEmail = () => {
    setCurrentStep(5)
  }

  const handleCompleteRegistration = () => {
    navigate(USER_ROUTES.DASHBOARD)
  }

  return (
    <div className="w-full min-h-screen bg-slate-100/70 flex flex-col justify-center items-center">
      {currentStep === 1 && (
        <SignupScreen1Mobile
          onBack={() => navigate(AUTH_ROUTES.LOGIN)}
          onNext={handleMobileSubmit}
          onSwitchToLogin={() => navigate(AUTH_ROUTES.LOGIN)}
        />
      )}

      {currentStep === 2 && (
        <SignupScreen2Otp
          phoneNumber={phoneNumber}
          onBack={() => setCurrentStep(1)}
          onNext={handleOtpVerified}
        />
      )}

      {currentStep === 3 && (
        <SignupScreen3Password
          onBack={() => setCurrentStep(2)}
          onNext={handlePasswordSet}
        />
      )}

      {currentStep === 4 && (
        <SignupScreen4Email
          onBack={() => setCurrentStep(3)}
          onNext={handleEmailSubmitted}
          onSkip={handleSkipEmail}
        />
      )}

      {currentStep === 5 && (
        <SignupScreen5Success onComplete={handleCompleteRegistration} />
      )}
    </div>
  )
}

export default RegisterPage
