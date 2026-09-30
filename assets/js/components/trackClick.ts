function post(el: HTMLElement, body: Record<string, string>) {
  fetch('/api/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      prisonerNumber: el.dataset.prisonerNumber ?? '',
      url: window.location.href,
      _csrf: el.dataset.csrfToken ?? '',
    }),
    cache: 'no-store',
    credentials: 'same-origin',
  }).catch(console.error) // eslint-disable-line no-console
}

// eslint-disable-next-line import/prefer-default-export
export function setupTrackClick() {
  document.querySelectorAll<HTMLElement>('[data-track-alert-click]').forEach(el => {
    el.addEventListener('click', () => {
      post(el, { elementType: 'alert-flag', alertLabel: el.dataset.alertLabel ?? '' })
    })
  })

  document.querySelectorAll<HTMLElement>('[data-track-case-note-click]').forEach(el => {
    el.addEventListener('click', () => {
      post(el, {
        elementType: 'view-case-note',
        scanId: el.dataset.scanId ?? '',
        caseNoteId: el.dataset.caseNoteId ?? '',
        scanOutcome: el.dataset.scanOutcome ?? '',
      })
    })
  })
}
