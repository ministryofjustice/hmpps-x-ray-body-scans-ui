// eslint-disable-next-line import/prefer-default-export
export function setupSignalEndJourney() {
  document.querySelectorAll<HTMLAnchorElement>('[data-signal-end-journey]').forEach(anchor => {
    const { signalEndJourney } = anchor.dataset
    if (signalEndJourney) {
      anchor.addEventListener('click', () => {
        fetch(`/api/signal-end-journey?name=${encodeURIComponent(signalEndJourney)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          priority: 'high',
          redirect: 'error',
        })
          // eslint-disable-next-line no-console
          .catch(console.error)
      })
    }
  })
}
