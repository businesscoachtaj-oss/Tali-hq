const { BASE } = require('../base')

module.exports = {
  key: 'find_client',
  noun: 'Client',
  display: { label: 'Find Client or Lead', description: 'Finds a client or lead in Tali HQ by email.' },
  operation: {
    inputFields: [{ key: 'email', label: 'Email', required: true }],
    perform: async (z, bundle) => {
      const r = await z.request({ url: `${BASE}/clients`, params: { email: bundle.inputData.email, limit: 1 } })
      return Array.isArray(r.data) ? r.data : []
    },
    sample: { id: 'sample', name: 'Ava Brown', kind: 'client', status: 'active', email: 'ava@example.com', phone: null, notes: '', source: 'you', created_at: '2026-11-27T09:00:00Z' },
  },
}
