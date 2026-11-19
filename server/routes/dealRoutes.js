const { createCrudRouter } = require('./crudRouteFactory')
const controller = require('../controllers/dealController')
const { requireDeleteAuthorization } = require('../middleware/permissionMiddleware')

module.exports = createCrudRouter(controller, {
  deleteMiddleware: requireDeleteAuthorization,
  extraRoutes: (router) => {
    router.get('/converted-from-account/:accountId', controller.getConvertedFromAccount)
    router.post('/import', controller.importDeals)
  },
})
