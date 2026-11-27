// Quick check that the app definition loads and has what we expect.
const app = require('./index')
const t = Object.keys(app.triggers), c = Object.keys(app.creates), s = Object.keys(app.searches)
console.log('triggers', t.length, t.join(', '))
console.log('creates', c.join(', '), '| searches', s.join(', '))
if (t.length !== 6 || c.length !== 4 || s.length !== 1) process.exit(1)
