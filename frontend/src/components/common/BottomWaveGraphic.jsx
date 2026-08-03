import React from 'react'

export function BottomWaveGraphic() {
  return (
    <div className="w-full overflow-hidden leading-none select-none pointer-events-none mt-auto">
      <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-24 md:h-28">
        <path
          d="M0,40 C150,90 350,-10 500,50 L500,120 L0,120 Z"
          fill="#F59E0B"
          opacity="0.9"
        />
        <path
          d="M0,60 C200,120 300,20 500,70 L500,120 L0,120 Z"
          fill="#1D4ED8"
        />
      </svg>
    </div>
  )
}

export default BottomWaveGraphic
