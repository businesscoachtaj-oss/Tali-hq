// Tali HQ on Zapier (ADDED 27 Nov 2026, Taj). Publish with the Zapier CLI (see README.md).
const authentication = require('./authentication')
const triggers = require('./triggers')
const { addLead, addClient } = require('./creates/add_lead')
const addReminder = require('./creates/add_reminder')
const addNote = require('./creates/add_note')
const findClient = require('./searches/find_client')

const addKey = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) request.headers.Authorization = `Bearer ${bundle.authData.api_key}`
  return request
}
const handleErrors = (response, z) => {
  if (response.status === 401) throw new z.errors.RefreshAuthError('That API key did not work. Make a new one in Tali HQ: Settings, Connections.')
  if (response.status >= 400) throw new z.errors.Error((response.json && response.json.error) || `Tali HQ said no (${response.status})`, 'TaliHQError', response.status)
  return response
}

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  authentication,
  beforeRequest: [addKey],
  afterResponse: [handleErrors],
  triggers: Object.fromEntries(triggers.map((t) => [t.key, t])),
  creates: { [addLead.key]: addLead, [addClient.key]: addClient, [addReminder.key]: addReminder, [addNote.key]: addNote },
  searches: { [findClient.key]: findClient },
  searchOrCreates: {
    find_client: { key: 'find_client', display: { label: 'Find or Add Client', description: 'Finds a client by email, or adds them.' }, search: 'find_client', create: 'add_client' },
  },
}
