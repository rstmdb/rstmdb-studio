import { useState, useEffect } from 'react'
import { X, Shield } from 'lucide-react'
import { GuardBuilder } from './GuardBuilder'

interface GuardBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  value: string | undefined
  onSave: (value: string | undefined) => void
}

export function GuardBuilderModal({ isOpen, onClose, value, onSave }: GuardBuilderModalProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    if (isOpen) {
      setLocalValue(value)
    }
  }, [isOpen, value])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(localValue)
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="flex items-center gap-2 font-semibold">
            <Shield className="w-5 h-5 text-warning" />
            Guard Expression
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted hover:text-foreground rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <GuardBuilder value={localValue} onChange={setLocalValue} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
