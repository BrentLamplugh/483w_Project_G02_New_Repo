export const WORKFLOW_STEPS = [
  { num: 1, label: 'Stimulus setup', path: 'stimuli' },
  { num: 2, label: 'CSV upload', path: 'upload' },
  { num: 3, label: 'Analysis', path: 'analysis' },
]

export function getStepPath(sessionId, stepNum) {
  const step = WORKFLOW_STEPS.find(s => s.num === stepNum)
  return step ? `/sessions/${sessionId}/${step.path}` : `/sessions/${sessionId}`
}

export function buildWorkflowState(session, stimuliCount, gazSummary) {
  const hasStimuli = (stimuliCount ?? 0) > 0 || !!session?.stimulus_loaded
  const csvUploaded = !!session?.csv_uploaded
  const hasAnalysisData = !!gazSummary
  const currentStep = !hasStimuli ? 1 : !csvUploaded ? 2 : 3

  return {
    hasStimuli,
    csvUploaded,
    hasAnalysisData,
    currentStep,
    completedStep: csvUploaded ? 3 : hasStimuli ? 1 : 0,
  }
}

export function isStepUnlocked(stepNum, workflowState) {
  if (stepNum === 1) return true
  if (stepNum === 2) return workflowState.hasStimuli
  if (stepNum === 3) return workflowState.csvUploaded
  return false
}

export function getFirstIncompleteStep(workflowState) {
  if (!workflowState.hasStimuli) return 1
  if (!workflowState.csvUploaded) return 2
  return 3
}

export function getStepStatus(stepNum, workflowState) {
  if (!isStepUnlocked(stepNum, workflowState)) return 'locked'
  if (stepNum < workflowState.currentStep || (stepNum === 3 && workflowState.csvUploaded)) return 'done'
  if (stepNum === workflowState.currentStep) return 'active'
  return 'pending'
}
