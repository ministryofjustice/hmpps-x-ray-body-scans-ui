import { Component } from 'govuk-frontend'

// eslint-disable-next-line import/prefer-default-export
export class FlashMessage extends Component<HTMLDivElement> {
  static moduleName = 'hmpps-flash-message'

  static elementType = HTMLDivElement

  constructor(root: HTMLDivElement) {
    super(root)

    // extract message and create alert element
    const alertContainer = root.querySelector('p')!
    alertContainer.removeAttribute('role')
    const message = alertContainer.textContent.trim()
    const alertSpan = document.createElement('span')
    alertSpan.role = 'alert'

    // re-insert message content after brief pause
    setTimeout(() => {
      alertContainer.textContent = ''
      alertContainer.appendChild(alertSpan)
      alertSpan.innerText = message
    }, 1_000)

    // eventually, remove entire component
    setTimeout(() => {
      if (root.parentNode) {
        root.parentNode.removeChild(root)
      }
    }, 10_000)
  }
}
