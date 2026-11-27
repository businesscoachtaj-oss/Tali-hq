const { BASE } = require('../base')

module.exports = {
  key: 'add_note',
  noun: 'Note',
  display: { label: 'Add Note for Tali', description: 'Adds a business note to Tali HQ. Tali reads your notes, so she knows what happened.' },
  operation: {
    inputFields: [
      { key: 'title', label: 'Title' },
      { key: 'body', label: 'Note', type: 'text', required: true },
    ],
    perform: async (z, bundle) => {
      const r = await z.request({ url: `${BASE}/notes`, method: 'POST', body: bundle.inputData })
      return r.data
    },
    sample: { id: 'sample', title: 'New Stripe payment', created_at: '2026-11-27T09:00:00Z' },
  },
}
