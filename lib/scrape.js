const ms = require('ms')
const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-lang')(),
  require('metascraper-logo')(),
  require('metascraper-logo-favicon')(),
  require('metascraper-publisher')(),
  require('metascraper-title')()
])
const httpError = require('http-errors')
const got = require('./got')
const logger = require('./logger')

// const nock = require('nock')
// nock.disableNetConnect()
// nock.enableNetConnect('keycloak:8080')
// nock('https://timeout.com')
//   .get('/')
//   .delay(100000)
//   .reply(200, '<html></html>')
//   .persist()

const timeoutMs = ms(process.env.LINK_TIMEOUT)

module.exports = async url => {
  const requestLogger = logger.child({ url })
  requestLogger.info(`Scraping %s for metadata...`, url)

  try {
    const { body: html, url: finalUrl } = await got(url, {
      // Got is fucking stupid and this is the only way we can actually get the fucking timeouts to work.
      timeout: { socket: timeoutMs, request: timeoutMs },
      context: { requestLogger }
    })
    return metascraper({ html, url: finalUrl })
  } catch (err) {
    if (process.env.USE_ANY_LINK_STATUS == 'true') {
      requestLogger.warn(`Ignoring error for URL ${url} due to USE_ANY_LINK_STATUS:`, err.message)
      return null
    }
    if (err.name === 'RequestError' && err.code === 'ENOTFOUND')
      throw httpError(404, 'The address to shorten does not exist!')
    if (err.name === 'TimeoutError')
      throw httpError(504, 'Could not scrape link in time!')
    // If we were able to reach an actual thing at the other end,
    // but the request got canceled because it's not an HTML,
    // we don't care about it as we cannot get any useful metadata from the response.
    if (err.name === 'CancelError') return null
    else throw err
  }
}
