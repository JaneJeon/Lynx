const { Issuer, Strategy, custom } = require('openid-client')
const passport = require('@passport-next/passport')
const { UniqueViolationError } = require('objection')
const ms = require('ms')
const User = require('../models/user')
const log = require('../lib/logger')
const { version } = require('../package.json')

custom.setHttpOptionsDefaults({
  headers: { 'User-Agent': `blink/${version}` },
  timeout: ms(process.env.OIDC_HTTP_TIMEOUT)
})

let client
// TODO: need ESM conversion for top-level await
Issuer.discover(process.env.OIDC_ISSUER_BASE_URL)
  .then(issuer => {
    log.info('Connected to OIDC issuer')

    client = new issuer.Client({
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
      redirect_uris: [`${process.env.BASE_URL}/auth/login/callback`]
    })

    passport.use(
      'oidc',
      new Strategy(
        { client, params: { scope: ['openid profile'] } },
        async (tokenSet, done) => {
          const claims = tokenSet.claims()
          const id = claims.sub
          const name = claims.preferred_username || claims.name || 'No Name'
          log.info('Trying to log in user %s with claims %o', id, claims)

          let user
          try {
            user = await User.query()
              .insertAndFetch({ id, name })
              .authorize()
              .fetchResourceContextFromDB()
            log.info('Provisioned user %s', id)
          } catch (e) {
            if (e instanceof UniqueViolationError) {
              log.info('Found user %s', id)
              user = await User.query().findById(id)
            } else {
              log.warn('User %s is forbidden from logging in', id)
              return done(e)
            }
          }

          // TODO: set session map on redis userSession:$userId -> [req.session.id]
          // to allow deleting sessions by user

          log.info('Done logging in user %s', id)
          done(null, user)
        }
      )
    )
  })
  .catch(err => {
    log.error(err)
    process.exit(404)
  })

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => {
  try {
    // TODO: cache this call
    const user = await User.query().findById(id)
    done(null, user || false)
  } catch (e) {
    done(e)
  }
})

module.exports = passport
