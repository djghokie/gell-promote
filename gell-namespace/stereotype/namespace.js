const namespace = require('../domain/namespace');

const create = require('../action/create');
const active = require('../snapshot/active');

/**
 * "namespace" stereotype: a SESSION that scopes other types (ECOSYSTEM, APPLICATION, TENANT)
 *
 * Extensions dispatch the inherited events as <EXTENSION>$<event>, e.g. APPLICATION$namespace.create#action, and
 * provide (read by the handlers from context, see gell-stereotype/middleware/extension)
 *  - types['GELL#NAMESPACE']: a type extension of GELL#NAMESPACE (name, parent, attributes)
 *  - parentContext: the context attribute holding the parent namespace entity (e.g. 'ecosystem_'); optional
 *
 * WIP: APPLICATION (stereotype/application.js) is the first extension; domain/application.js still defines its model
 */
module.exports = {
    name: 'GELL#NAMESPACE',
    description: 'general mechanism for segregating and isolating data in a shared data store',

    types: {
        'GELL#NAMESPACE': namespace
    },

    actions: [create],
    snapshots: [active],
}
