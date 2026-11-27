// Polling triggers. Zapier asks every few minutes for the newest items and starts the Zap for any id
// it has not seen before, so each item runs once.
const { BASE } = require('../base')

module.exports = ({ key, noun, label, description, path, sample, idFrom }) => ({
  key,
  noun,
  display: { label, description },
  operation: {
    perform: async (z) => {
      const r = await z.request({ url: `${BASE}${path}`, params: { limit: 50 } })
      const rows = Array.isArray(r.data) ? r.data : []
      return idFrom ? rows.map((x) => ({ ...x, id: idFrom(x) })) : rows
    },
    sample,
  },
})
