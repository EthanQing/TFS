const PROJECT_TRAINING_ALERTS_DIRTY_KEY = 'projectTrainingAlertsDirtyAt';

function canUseStorage() {
  return typeof window !== 'undefined' && window.localStorage;
}

export function markProjectTrainingAlertsDirty(reason = '') {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      PROJECT_TRAINING_ALERTS_DIRTY_KEY,
      JSON.stringify({
        at: Date.now(),
        reason: String(reason || ''),
      })
    );
  } catch (_) {
    0;
  }
}

export function consumeProjectTrainingAlertsDirty() {
  if (!canUseStorage()) return false;
  try {
    const value = window.localStorage.getItem(PROJECT_TRAINING_ALERTS_DIRTY_KEY);
    if (!value) return false;
    window.localStorage.removeItem(PROJECT_TRAINING_ALERTS_DIRTY_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

export function cameFromTrainingAlertSource(route) {
  const path = String(route && route.path ? route.path : '');
  return path === '/training-report' || path === '/projectsdetail' || path.startsWith('/projectscharts');
}
