const namespace = require('./namespace');
const ecosystem = require('../domain/ecosystem');

const TYPE = 'NAMESPACE#APPLICATION';

/**
 * APPLICATION: extension of the "namespace" stereotype
 *
 * NOTE: dispatch inherited events as APPLICATION$<event>, e.g. APPLICATION$namespace.create#action
 *
 * WIP: the model is still defined (and registered with the types registry) by domain/application.js
 */
module.exports = {
    name: 'APPLICATION',
    extends: namespace,

    types: {
        'GELL#NAMESPACE': {
            name: 'NAMESPACE#APPLICATION',
            parent: ecosystem,
            attributes: {
                type: {
                    type: 'string',
                    default: 'NAMESPACE#APPLICATION'
                },
            }
        }
    },

    // NOTE: the namespace middleware puts the ECOSYSTEM in context.ecosystem_
    parentContext: 'ecosystem_',
}
