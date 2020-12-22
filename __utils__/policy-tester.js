const policies = require('../policies')

// simplified signature for testing
module.exports = (user, resourceName) => {
  const checkACL = (action, resource, fields, body) => {
    resource = resource || resourceName
    const policy = policies(user, resource, action, body)

    return policy.can(action, resource, fields)
  }

  const can = (action, resource, fields, body) =>
    expect(checkACL(action, resource, fields, body)).toBe(true)
  const cannot = (action, resource, fields, body) =>
    expect(checkACL(action, resource, fields, body)).toBe(false)

  return { can, cannot }
}
