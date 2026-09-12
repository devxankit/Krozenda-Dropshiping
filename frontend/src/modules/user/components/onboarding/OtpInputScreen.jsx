import React, { useState, useEffect, useRef } from 'react'
import {
  HiArrowLeft,
  HiExclamationCircle,
  HiArrowPath,
  HiCheckCircle,
  HiSparkles,
  HiShieldCheck,
  HiLockClosed,
  HiPencilSquare,
} from 'react-icons/hi2'

export function OtpInputScreen({
  phoneNumber = '',
  isRegistered = null,
  onBack = () => {},
  onVerifySuccess = () => {},
  onResendOtp = () => {},
  isLoading = false,
  error = null,
}) {
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [timer, setTimer] = useState(45)
  const [resendNotice, setResendNotice] = useState('')
  const inputRefs = useRef([])

  useEffect(() => {
    // Focus first empty box on mount
    const firstEmpty = otp.findIndex((d) => !d)
    const targetIdx = firstEmpty === -1 ? 0 : firstEmpty
    inputRefs.current[targetIdx]?.focus()
  }, [])

  useEffect(() => {
    let interval = null
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timer])

  const handleChange = (index, value) => {
    const cleanChar = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = cleanChar
    setOtp(newOtp)

    if (cleanChar && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    if (cleanChar && index === 5) {
      const fullOtp = [...newOtp.slice(0, 5), cleanChar].join('')
      if (fullOtp.length === 6) {
        onVerifySuccess(fullOtp)
      }
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pastedData) return

    const newOtp = ['', '', '', '', '', '']
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i]
    }
    setOtp(newOtp)

    const nextFocusIdx = Math.min(pastedData.length, 5)
    inputRefs.current[nextFocusIdx]?.focus()

    if (pastedData.length === 6) {
      onVerifySuccess(pastedData)
    }
  }

  const handleResend = async () => {
    setTimer(45)
    setResendNotice('OTP resent successfully!')
    setTimeout(() => setResendNotice(''), 3500)
    if (onResendOtp) {
      onResendOtp()
    }
  }

  const handleVerifyClick = () => {
    const enteredOtp = otp.join('').trim()
    if (enteredOtp.length === 6) {
      onVerifySuccess(enteredOtp)
    }
  }

  const formatTimer = (sec) => {
    const s = sec < 10 ? `0${sec}` : sec
    return `00:${s}`
  }

  const isOtpComplete = otp.every((d) => d !== '')

  return (
    <div className="w-full h-full min-h-full bg-slate-50 flex flex-col justify-between font-sans">
      {/* App Top Bar */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all active:scale-95"
          aria-label="Back"
        >
          <HiArrowLeft className="w-4 h-4" />
        </button>

        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Step 2 of 2
        </span>
      </div>

      {/* Content Body */}
      <div className="px-5 sm:px-8 py-4 flex-1 flex flex-col justify-center items-center text-center space-y-4">
        <img
          src="/images/logo.png"
          alt="Krozenda Logo"
          className="h-16 sm:h-20 w-auto object-contain"
        />

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Enter OTP Code
          </h2>
          <div className="flex items-center justify-center space-x-1.5 text-xs text-slate-500 mt-1">
            <span>Sent 6-digit code to</span>
            <strong className="text-slate-900 font-bold">+91 {phoneNumber}</strong>
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded text-blue-600 hover:text-blue-800 transition-colors"
              title="Change phone number"
            >
              <HiPencilSquare className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Account Status Badge */}
        {isRegistered !== null && (
          <div
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
              isRegistered
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}
          >
            {isRegistered ? (
              <>
                <HiShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Existing Member • Direct Login</span>
              </>
            ) : (
              <>
                <HiSparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>New Customer • Auto-Registration</span>
              </>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="w-full max-w-sm flex items-start space-x-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left animate-shake">
            <HiExclamationCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="font-medium leading-snug">{error}</div>
          </div>
        )}

        {/* Resend Success Notice */}
        {resendNotice && (
          <div className="w-full max-w-sm flex items-center space-x-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs text-left">
            <HiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{resendNotice}</span>
          </div>
        )}

        {/* 6 Digit OTP Inputs */}
        <div className="w-full max-w-sm pt-1">
          <div className="flex justify-center space-x-2 sm:space-x-2.5 mb-5" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                id={`otp-input-box-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isLoading}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-10 sm:w-12 h-12 sm:h-14 bg-white border rounded-xl text-center font-black text-xl text-slate-900 focus:outline-none transition-all shadow-xs ${
                  digit
                    ? 'border-blue-600 bg-blue-50/20'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleVerifyClick}
            disabled={isLoading || !isOtpComplete}
            className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold h-12 rounded-2xl shadow-md transition-all text-xs tracking-wide flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <HiArrowPath className="w-4 h-4 animate-spin" />
                <span>Verifying OTP...</span>
              </>
            ) : (
              <span>Verify & Login</span>
            )}
          </button>
        </div>

        {/* Timer and Resend Actions */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-slate-500">
            {timer > 0 ? (
              <span>
                Resend OTP in <strong className="text-blue-600 font-mono">{formatTimer(timer)}</strong>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-blue-600 font-bold hover:underline inline-flex items-center space-x-1"
              >
                <HiArrowPath className="w-3.5 h-3.5" />
                <span>Resend OTP Code</span>
              </button>
            )}
          </div>

          <div className="text-xs">
            <span className="text-slate-400">Entered wrong number? </span>
            <button
              type="button"
              onClick={onBack}
              className="text-blue-700 font-bold hover:underline"
            >
              Change Number
            </button>
          </div>
        </div>
      </div>

      {/* Compact App Footer */}
      <div className="px-4 py-3 bg-white border-t border-slate-100 flex items-center justify-center space-x-2 text-[10.5px] text-slate-400 shrink-0">
        <HiLockClosed className="w-3.5 h-3.5 text-emerald-600" />
        <span>Encrypted OTP • 100% Protected</span>
      </div>
    </div>
  )
}

export default OtpInputScreen
