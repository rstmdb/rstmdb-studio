import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, AlertCircle } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { machines, type MachineDefinition } from '@/lib/api'
import { MachineBuilder } from '@/components/machine-builder'
import type { ViewMode } from '@/lib/machine-builder/types'

/**
 * Compare two machine definitions, ignoring meta._builderPositions
 * which only stores visual layout information.
 */
function definitionsEqual(
  a: MachineDefinition | undefined,
  b: MachineDefinition | undefined
): boolean {
  if (!a || !b) return false

  // Compare states
  if (JSON.stringify([...a.states].sort()) !== JSON.stringify([...b.states].sort())) {
    return false
  }

  // Compare initial
  if (a.initial !== b.initial) return false

  // Compare transitions (normalize for comparison)
  const normalizeTransitions = (transitions: MachineDefinition['transitions']) =>
    transitions
      .map((t) => ({
        from: Array.isArray(t.from) ? [...t.from].sort().join(',') : t.from,
        event: t.event,
        to: t.to,
        guard: t.guard || '',
      }))
      .sort((x, y) => `${x.from}-${x.event}-${x.to}`.localeCompare(`${y.from}-${y.event}-${y.to}`))

  const aNorm = normalizeTransitions(a.transitions)
  const bNorm = normalizeTransitions(b.transitions)

  if (JSON.stringify(aNorm) !== JSON.stringify(bNorm)) return false

  // Compare meta (excluding _builderPositions)
  const aMeta = { ...(a.meta || {}) }
  const bMeta = { ...(b.meta || {}) }
  delete aMeta._builderPositions
  delete bMeta._builderPositions

  if (JSON.stringify(aMeta) !== JSON.stringify(bMeta)) return false

  return true
}

export function MachineDetailPage() {
  const { name } = useParams<{ name: string }>()
  const queryClient = useQueryClient()
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [definition, setDefinition] = useState<MachineDefinition | undefined>()
  const [viewMode, setViewMode] = useState<ViewMode>('visual')
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: Array<{ code: string; message: string; path?: string }>
    warnings: Array<{ code: string; message: string; path?: string }>
  } | null>(null)

  const { data: machineInfo, isLoading } = useQuery({
    queryKey: ['machine', name],
    queryFn: () => machines.get(name!),
    enabled: !!name,
  })

  const { data: versionData } = useQuery({
    queryKey: ['machine-version', name, selectedVersion],
    queryFn: () => machines.getVersion(name!, selectedVersion!),
    enabled: !!name && selectedVersion !== null,
  })

  // Set initial version when machine info loads
  useEffect(() => {
    if (machineInfo && selectedVersion === null) {
      const latest = Math.max(...machineInfo.versions)
      setSelectedVersion(latest)
    }
  }, [machineInfo, selectedVersion])

  // Update editor and definition when version data loads
  useEffect(() => {
    if (versionData) {
      const json = JSON.stringify(versionData.definition, null, 2)
      setEditorValue(json)
      setDefinition(versionData.definition)
    }
  }, [versionData])

  const validateMutation = useMutation({
    mutationFn: (def: unknown) => machines.validate(def),
    onSuccess: (result) => {
      setValidationResult(result)
    },
  })

  const createVersionMutation = useMutation({
    mutationFn: (def: unknown) =>
      machines.createVersion(name!, def as MachineDefinition, {
        baseVersion: selectedVersion ?? undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['machine', name] })
      setValidationResult(null)
      // Select the new version if created
      if (result.created) {
        setSelectedVersion(result.version)
      }
    },
  })

  // Check if current definition differs from the loaded version
  const hasChanges = useMemo(() => {
    if (!versionData?.definition || !definition) return false
    return !definitionsEqual(definition, versionData.definition)
  }, [definition, versionData?.definition])

  // Handle changes from the visual builder
  const handleBuilderChange = useCallback((newDefinition: MachineDefinition) => {
    setDefinition(newDefinition)
    setEditorValue(JSON.stringify(newDefinition, null, 2))
    // Clear validation so user knows to re-validate
    setValidationResult(null)
  }, [])

  // Handle changes from the JSON editor
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
    try {
      const def = JSON.parse(editorValue)
      validateMutation.mutate(def)
    } catch {
      setValidationResult({
        valid: false,
        errors: [{ code: 'PARSE_ERROR', message: 'Invalid JSON' }],
        warnings: [],
      })
    }
  }

  const handleSave = () => {
    try {
      const def = JSON.parse(editorValue)
      createVersionMutation.mutate(def)
    } catch {
      // Handle error
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/machines"
          className="p-2 hover:bg-surface rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="text-muted text-sm">
            {machineInfo?.versions.length} version
            {machineInfo?.versions.length !== 1 ? 's' : ''}
          </p>
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
            onClick={handleSave}
            disabled={
              createVersionMutation.isPending ||
              !validationResult?.valid ||
              !hasChanges
            }
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title={!hasChanges ? 'No changes to save' : undefined}
          >
            {hasChanges ? 'Save New Version' : 'No Changes'}
          </button>
        </div>
      </div>

      {/* Version Selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted">Version:</span>
        <div className="flex gap-1">
          {machineInfo?.versions.map((v) => (
            <button
              key={v}
              onClick={() => setSelectedVersion(v)}
              className={`px-3 py-1 text-sm rounded ${
                selectedVersion === v
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border hover:border-primary/50'
              }`}
            >
              v{v}
            </button>
          ))}
        </div>
      </div>

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

      {/* Validation Results */}
      {validationResult && viewMode === 'json' && (
        <div
          className={`mt-4 border rounded-lg p-4 ${
            validationResult.valid
              ? 'border-secondary bg-secondary/10'
              : 'border-destructive bg-destructive/10'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {validationResult.valid ? (
              <>
                <Check className="w-5 h-5 text-secondary" />
                <span className="font-medium text-secondary">
                  Validation passed
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-destructive" />
                <span className="font-medium text-destructive">
                  Validation failed
                </span>
              </>
            )}
          </div>

          {validationResult.errors.length > 0 && (
            <ul className="space-y-1 text-sm">
              {validationResult.errors.map((err, i) => (
                <li key={i} className="text-destructive">
                  {err.path && <span className="text-muted">{err.path}: </span>}
                  {err.message}
                </li>
              ))}
            </ul>
          )}

          {validationResult.warnings.length > 0 && (
            <ul className="space-y-1 text-sm mt-2">
              {validationResult.warnings.map((warn, i) => (
                <li key={i} className="text-warning">
                  {warn.path && <span className="text-muted">{warn.path}: </span>}
                  {warn.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
