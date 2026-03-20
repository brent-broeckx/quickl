import React from 'react'

type ProviderIconProps = {
  name: string
  className?: string
}

const COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-orange-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500'
]

function LetterAvatar({ name, className }: Readonly<ProviderIconProps>): React.ReactElement {
  const letter = name.trim().charAt(0).toUpperCase() || '?'
  const color = COLORS[name.length % COLORS.length]
  return (
    <div
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white ${color} ${className || ''}`}
      aria-hidden="true"
    >
      {letter}
    </div>
  )
}

export function ProviderLogo({ name, className }: Readonly<ProviderIconProps>): React.ReactElement {
  const normalized = name.trim().toLowerCase()

  if (normalized === 'openai') {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-black text-white ${className || ''}`}>
        O
      </div>
    )
  }

  if (normalized === 'anthropic') {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-700 text-white ${className || ''}`}>
        A
      </div>
    )
  }

  if (normalized === 'google' || normalized === 'google gemini') {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white ${className || ''}`}>
        G
      </div>
    )
  }

  if (normalized === 'mistral') {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-white ${className || ''}`}>
        M
      </div>
    )
  }

  if (normalized === 'groq') {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-600 text-white ${className || ''}`}>
        G
      </div>
    )
  }

  if (normalized === 'ollama') {
    return (
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-white ${className || ''}`}>
        O
      </div>
    )
  }

  return <LetterAvatar name={name} className={className} />
}
