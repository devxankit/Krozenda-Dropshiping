import React, { useState, useEffect } from 'react'
import { HiArrowLeft } from 'react-icons/hi2'
import { BottomWaveGraphic } from '../../../../components/common/BottomWaveGraphic'
import { DesktopLeftShowcase } from '../../../../components/common/DesktopLeftShowcase'

export function SignupScreen2Otp({
  phoneNumber = '98765 43210',
  onBack = () => {},
  onNext = () => {},
}) {
  const [otp, setOtp] = useState(['1', '2', '3', '4', '5', '6'])
  const [timer, setTimer] = useState(45)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleChange = (index, value) => {
    if (value.length > 1) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      document.getElementById(`signup-otp-${index + 1}`)?.focus()
    }
  }

  const formatTimer = (sec) => {
    const s = sec < 10 ? `0${sec}` : sec
    return `00:${s}`
  }

  return (
    <div className="w-full min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans">
      {/* DESKTOP LEFT SHOWCASE */}
      <DesktopLeftShowcase
        title="Verify Your Phone Number"
        subtitle="Quick 6-digit verification to safeguard your seller account and billing data."
        tag="SECURITY VERIFICATION"
      />

      {/* RIGHT SIDE: AUTH STEP FLOW */}
      <div className="w-full md:w-[480px] lg:w-[540px] shrink-0 min-h-screen bg-white flex flex-col justify-between shadow-2xl relative">
        

        <div className="px-6 py-2 flex items-center">
          <button
            onClick={onBack}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <HiArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 md:px-10 py-4 flex-1 flex flex-col items-center text-center space-y-6">
          <img src="/images/logo.png" alt="Krozenda Logo" className="h-28 md:h-32 w-auto object-contain" />

          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900">Enter OTP</h2>
            <p className="text-xs text-slate-500 mt-1">
              We have sent a 6 digit OTP to <br />
              <strong className="text-slate-900">+91 {phoneNumber}</strong>
            </p>
          </div>

          <div className="w-full max-w-sm pt-2">
            <div className="flex justify-center space-x-2 md:space-x-2.5 mb-6">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`signup-otp-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  className={`w-10 md:w-12 h-12 md:h-14 bg-white border rounded-xl text-center font-black text-lg text-slate-900 focus:outline-none transition-all ${
                    idx === 5
                      ? 'border-blue-600 ring-2 ring-blue-500/20'
                      : 'border-slate-300 focus:border-blue-600'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={onNext}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all text-xs tracking-wide"
            >
              Verify & Continue
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-slate-500">
              {timer > 0 ? (
                <span>Resend OTP in <strong className="text-blue-600">{formatTimer(timer)}</strong></span>
              ) : (
                <button
                  onClick={() => setTimer(45)}
                  className="text-blue-600 font-bold hover:underline"
                >
                  Resend OTP Code
                </button>
              )}
            </div>

            <div className="text-xs">
              <button
                onClick={onBack}
                className="text-blue-700 font-bold hover:underline"
              >
                Change Number
              </button>
            </div>
          </div>
        </div>

        <BottomWaveGraphic />
      </div>
    </div>
  )
}
