const { BASE } = require('../base')

module.exports = {
  key: 'add_reminder',
  noun: 'Reminder',
  display: { label: 'Add Reminder', description: 'Adds a reminder in Tali HQ. Tali nudges you when it is due.' },
  operation: {
    inputFields: [
      { key: 'text', label: 'Remind me to', required: true },
      { key: 'due_at', label: 'When', type: 'datetime', helpText: 'Leave blank for tomorrow at 9am (Sydney time).' },
    ],
    perform: async (z, bundle) => {
      const r = await z.request({ url: `${BASE}/reminders`, method: 'POST', body: bundle.inputData })
      return r.data
    },
    sample: { id: 'sample', text: 'Call Sam back about the quote', due_at: '2026-11-28T22:00:00Z', created_at: '2026-11-27T09:00:00Z' },
  },
}
