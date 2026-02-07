import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Check, AlertCircle } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { machines, type MachineDefinition } from '@/lib/api'
import { MachineBuilder } from '@/components/machine-builder'
import type { ViewMode } from '@/lib/machine-builder/types'

const DEFAULT_DEFINITION: MachineDefinition = {
  states: [],
  initial: '',
  transitions: [],
}

export function CreateMachinePage() {
  const navigate = useNavigate()
  const [machineName, setMachineName] = useState('')
  const [definition, setDefinition] = useState<MachineDefinition>(DEFAULT_DEFINITION)
  const [editorValue, setEditorValue] = useState(JSON.stringify(DEFAULT_DEFINITION, null, 2))
  const [viewMode, setViewMode] = useState<ViewMode>('visual')
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: Array<{ code: string; message: string; path?: string }>
    warnings: Array<{ code: string; message: string; path?: string }>
  } | null>(null)

  const validateMutation = useMutation({
    mutationFn: (def: unknown) => machines.validate(def),
    onSuccess: (result) => {
      setValidationResult(result)
    },
  })

  const createMutation = useMutation({
    mutationFn: ({ name, def }: { name: string; def: MachineDefinition }) =>
      machines.createVersion(name, def, { version: 1 }),
    onSuccess: (_, variables) => {
      navigate(`/machines/${variables.name}`)
    },
  })

  const handleBuilderChange = useCallback((newDefinition: MachineDefinition) => {
    setDefinition(newDefinition)
    setEditorValue(JSON.stringify(newDefinition, null, 2))
    setValidationResult(null)
  }, [])

  const handleEditorChange = useCallback((value: string | undefined) => {
    setEditorValue(value || '')
    try {
      const parsed = JSON.parse(value || '{}') as MachineDefinition
      setDefinition(parsed)
      setValidationResult(null)
    } catch {
      // Invalid JSON, don't update definition
    }
  }, [])

  const handleValidate = () => {
    if (!machineName.trim()) {
      setValidationResult({
        valid: false,
        errors: [{ code: 'NAME_REQUIRED', message: 'Machine name is required' }],
        warnings: [],
      })
      return
    }
    try {
      const def = viewMode === 'json' ? JSON.parse(editorValue) : definition
      validateMutation.mutate(def)
    } catch {
      setValidationResult({
        valid: false,
        errors: [{ code: 'PARSE_ERROR', message: 'Invalid JSON' }],
        warnings: [],
      })
    }
  }

  const handleCreate = () => {
    if (!machineName.trim() || !validationResult?.valid) return
    try {
      const def = viewMode === 'json' ? JSON.parse(editorValue) : definition
      createMutation.mutate({ name: machineName.trim(), def })
    } catch {
      // Invalid JSON
    }
  }

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    // Sync definition before switching views
    if (mode === 'visual' && viewMode === 'json') {
      try {
        const parsed = JSON.parse(editorValue) as MachineDefinition
        setDefinition(parsed)
      } catch {
        // Keep current definition if JSON is invalid
      }
    }
    setViewMode(mode)
  }, [viewMode, editorValue])

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/machines')}
          className="p-2 hover:bg-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Create New Machine</h1>
          <p className="text-muted text-sm">Design your state machine visually or in JSON</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleValidate}
            disabled={validateMutation.isPending}
            className="px-3 py-1.5 text-sm bg-surface border border-border rounded-lg hover:border-primary/50 transition-colors"
          >
            Validate
          </button>
          <button
            onClick={handleCreate}
            disabled={
              createMutation.isPending ||
              !validationResult?.valid ||
              !machineName.trim()
            }
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Create Machine
          </button>
        </div>
      </div>

      {/* Machine Name Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Machine Name</label>
        <input
          type="text"
          value={machineName}
          onChange={(e) => setMachineName(e.target.value)}
          placeholder="e.g., order-workflow, payment-state"
          className="w-full max-w-md px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div
          className={`mb-4 border rounded-lg p-3 ${
            validationResult.valid
              ? 'border-secondary bg-secondary/10'
              : 'border-destructive bg-destructive/10'
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <>
                <Check className="w-4 h-4 text-secondary" />
                <span className="text-sm font-medium text-secondary">
                  Validation passed - ready to create
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {validationResult.errors[0]?.message || 'Validation failed'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error from create mutation */}
      {createMutation.error && (
        <div className="mb-4 border border-destructive bg-destructive/10 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Failed to create machine'}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        {viewMode === 'visual' ? (
          <MachineBuilder
            definition={definition}
            onChange={handleBuilderChange}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />
        ) : (
          <div className="h-full flex flex-col border border-border rounded-lg overflow-hidden">
            {/* JSON Editor Toolbar */}
            <div className="bg-surface px-4 py-2 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">Definition (JSON)</span>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => handleViewModeChange('visual')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-background hover:bg-surface text-foreground transition-colors"
                >
                  Visual
                </button>
                <button
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white transition-colors"
                >
                  JSON
                </button>
              </div>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                language="json"
                theme="vs-dark"
                value={editorValue}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
