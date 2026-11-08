const namespace = require('../domain/namespace');

const create = require('../action/create');
const active = require('../snapshot/active');

/**
 * "namespace" stereotype: a SESSION that scopes other types (ECOSYSTEM, APPLICATION, TENANT)
 *
 * Extensions dispatch the inherited events as <EXTENSION>$<event>, e.g. APPLICATION$namespace.create#action, and
 * provide (read by the handlers from context.extension)
 *  - TYPE: the extension's registered type
 *  - parentContext: the context attribute holding the parent namespace entity (e.g. 'ecosystem_')
 *
 * WIP: APPLICATION (stereotype/application.js) is the first extension; domain/application.js still defines its model
 */
module.exports = {
    name: 'namespace',
    description: 'scopes other types; ids are relative to a parent namespace',
    model: namespace.model,

    actions: [create],
    snapshots: [active],
}
