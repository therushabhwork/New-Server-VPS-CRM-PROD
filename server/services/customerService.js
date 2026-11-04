const customerRepository = require('../repositories/customerRepository')
const { createCrudService } = require('./crudServiceFactory')
const { AppError } = require('../utils/appError')
const { customerCreate, customerUpdate } = require('../validation/schemas')

const buildPayload = (body, actor, existing) => {
  const name = body.name ?? existing?.name
  if (!name) throw new AppError('Customer name is required.', 400)
  return {
    name,
    email: body.email ?? existing?.email ?? null,
    phone: body.phone ?? existing?.phone ?? null,
    company: body.company ?? existing?.company ?? null,
    address: body.address ?? existing?.address ?? null,
    city: body.city ?? existing?.city ?? null,
    state: body.state ?? existing?.state ?? null,
    country: body.country ?? existing?.country ?? null,
    postalCode: body.postalCode ?? existing?.postalCode ?? null,
    status: body.status ?? existing?.status ?? 'active',
    source: body.source ?? existing?.source ?? null,
    assignedTo: body.assignedTo ?? existing?.assignedTo ?? (actor.role === 'user' ? actor.id : null),
    createdBy: existing?.createdBy ?? actor.id,
    data: { ...(existing?.data || {}), ...body },
  }
}

const service = createCrudService({
  repository: customerRepository,
  entityLabel: 'Customer',
  entityType: 'customer',
  buildPayload,
})

service.validation = {
  create: customerCreate,
  update: customerUpdate,
}

const applyStrictIsolation = (actor) => {
  const email = String(actor?.email || '').toLowerCase().trim()
  const name = String(actor?.name || '').toLowerCase().trim()
  const username = String(actor?.username || '').toLowerCase().trim()
  const actorId = String(actor?.id || actor?._id || actor?.legacyId || '').trim()

  const isKeval = email === 'keval@swatiswitchgears.com' || name.includes('keval') || username.includes('keval') || actorId === '16'
  const isSamir = email === 'samirsheth@swatiswitchgears.com' || email.startsWith('samir.sheth@') || email.startsWith('samirsheth@') || name.includes('samir sheth') || name.includes('samir seth') || username.includes('samir-sheth') || username.includes('samirsheth') || actorId === '15'

  if (isKeval || isSamir || actor?.role === 'admin' || actor?.role === 'super_admin') {
    return { ...actor, role: 'admin' }
  }
  return { ...actor, role: 'user' }
}

module.exports = {
  ...service,
  list: (actor, filters = {}) => service.list(applyStrictIsolation(actor), filters),
  get: (actor, id) => service.get(applyStrictIsolation(actor), id),
  search: (actor, query) => service.search(applyStrictIsolation(actor), query),
}
