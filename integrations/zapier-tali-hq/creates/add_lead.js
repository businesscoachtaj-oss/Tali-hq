const { BASE } = require('../base')

const make = (kind) => ({
  key: kind === 'lead' ? 'add_lead' : 'add_client',
  noun: kind === 'lead' ? 'Lead' : 'Client',
  display: {
    label: kind === 'lead' ? 'Add Lead' : 'Add Client',
    description: kind === 'lead' ? 'Adds a lead to Tali HQ, so Tali can help you follow it up.' : 'Adds a client to Tali HQ.',
  },
  operation: {
    inputFields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', helpText: 'If someone with this email is already in Tali HQ, they are returned and nothing new is added.' },
      { key: 'phone', label: 'Phone' },
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
    perform: async (z, bundle) => {
      const r = await z.request({ url: `${BASE}/clients`, method: 'POST', body: { ...bundle.inputData, kind } })
      return r.data
    },
    sample: { id: 'sample', name: 'Sam Lee', kind, status: kind === 'lead' ? 'new' : 'active', email: 'sam@example.com', phone: null, notes: '', source: 'zapier', created_at: '2026-11-27T09:00:00Z', existing: false },
  },
})

module.exports = { addLead: make('lead'), addClient: make('client') }
