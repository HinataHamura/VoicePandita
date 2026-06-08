export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function subscribeNetworkChanges(callback: (online: boolean) => void) {
  if (typeof window === 'undefined') return () => undefined

  const notify = () => callback(isOnline())
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  callback(isOnline())

  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}
