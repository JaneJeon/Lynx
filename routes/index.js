const { Router } = require('express')

module.exports = Router()
  .use('/api', require('../middlewares/require-auth'), require('./api'))
  .use('/app', require('./app'))
  .use('/auth', require('./auth'))
  .use('/', require('./redirect'))
