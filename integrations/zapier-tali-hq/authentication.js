const { BASE } = require('./base')

module.exports = {
  type: 'custom',
  fields: [{
    key: 'api_key', label: 'API key', required: true, type: 'password',
    helpText: 'In Tali HQ, go to Settings, then Connections, and tap Make a key under Zapier and the Tali HQ API. It starts with thq_live_.',
  }],
  test: { url: `${BASE}/me` },
  connectionLabel: '{{json.business}}',
}
