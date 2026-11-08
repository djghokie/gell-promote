const namespace = require('../domain/namespace');

/**
 * "namespace" stereotype: a SESSION that scopes other types (ECOSYSTEM, APPLICATION, TENANT)
 *
 * WIP: APPLICATION (domain/application.js) should become an extension of this stereotype
 *  - for now the stereotype only exposes the base namespace model
 */
module.exports = {
    name: 'namespace',
    description: 'scopes other types; ids are relative to a parent namespace',
    model: namespace.model,
}
