const make = require('./factory')

module.exports = [
  make({
    key: 'new_lead', noun: 'Lead', label: 'New Lead',
    description: 'Starts when a new lead is added in Tali HQ.',
    path: '/clients?kind=lead',
    sample: { id: 'sample-lead', name: 'Sam Lee', kind: 'lead', status: 'new', email: 'sam@example.com', phone: '0400 000 000', notes: '', source: 'website', next_follow_up: null, created_at: '2026-11-27T09:00:00Z' },
  }),
  make({
    key: 'new_client', noun: 'Client', label: 'New Client',
    description: 'Starts when a new client is added in Tali HQ.',
    path: '/clients?kind=client',
    sample: { id: 'sample-client', name: 'Ava Brown', kind: 'client', status: 'active', email: 'ava@example.com', phone: null, notes: '', source: 'you', next_follow_up: null, created_at: '2026-11-27T09:00:00Z' },
  }),
  make({
    key: 'new_enquiry', noun: 'Enquiry', label: 'New Website Enquiry',
    description: 'Starts when someone fills in the enquiry form on your Tali HQ website.',
    path: '/enquiries',
    sample: { id: 'sample-enquiry', name: 'Jordan Smith', email: 'jordan@example.com', phone: null, message: 'Do you have time next week for a quote?', client_id: null, created_at: '2026-11-27T09:00:00Z' },
  }),
  make({
    key: 'new_booking', noun: 'Booking', label: 'New Booking',
    description: 'Starts when a booking is made, by you, by Tali or through your booking link.',
    path: '/bookings',
    sample: { id: 'sample-booking', title: 'First consult', client_name: 'Ava Brown', client_email: 'ava@example.com', client_phone: null, starts_at: '2026-11-28T00:00:00Z', minutes: 60, place: '', status: 'booked', source: 'link', notes: '', created_at: '2026-11-27T09:00:00Z' },
  }),
  make({
    key: 'invoice_paid', noun: 'Invoice', label: 'Invoice Paid',
    description: 'Starts when an invoice is marked paid.',
    path: '/invoices/paid',
    sample: { id: 'sample-invoice', number: 'INV-0012', client_name: 'Ava Brown', client_email: 'ava@example.com', total: 220, gst_amount: 20, issue_date: '2026-11-20', paid_at: '2026-11-27T09:00:00Z', paid_via: 'stripe' },
  }),
  make({
    key: 'quote_accepted', noun: 'Quote', label: 'Quote Accepted',
    description: 'Starts when a customer says yes to a quote.',
    path: '/quotes/accepted',
    sample: { id: 'sample-quote', number: 'Q-0007', title: 'Bathroom tiling', client_name: 'Jordan Smith', client_email: 'jordan@example.com', total: 3850, status: 'accepted', accepted_at: '2026-11-27T09:00:00Z' },
  }),
]
