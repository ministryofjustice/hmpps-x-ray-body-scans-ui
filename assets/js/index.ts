import * as govukFrontend from 'govuk-frontend'
import * as mojFrontend from '@ministryofjustice/frontend'
import * as connectDps from '@ministryofjustice/hmpps-connect-dps-shared-items/dist/assets/js/all'
import { FlashMessage } from './components/flashMessage'
import { setupSignalEndJourney } from './components/signalEndJourney'
import { setupTrackClick } from './components/trackClick'

govukFrontend.initAll()
mojFrontend.initAll()
connectDps.initAll()

document.addEventListener('DOMContentLoaded', () => {
  govukFrontend.createAll(FlashMessage)
  setupSignalEndJourney()
  setupTrackClick()
})
