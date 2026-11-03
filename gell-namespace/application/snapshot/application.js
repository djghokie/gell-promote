const assert = require('assert');
const _ = require('lodash');

const application = require('gell-promote/gell-namespace/domain/application');
const namespace = require('gell-promote/gell-namespace/snapshot/namespace');

exports.__metadata = {
    name: 'namespace.application.lookup',
    description: 'returns an APPLICATION by id',
    triggers: {
        api: {
            params: {
                id: {
                    type: 'string',
                    optional: true
                }
            }
        }
    }
}

async function doLookup(id, deps) {
    return namespace.effect({
        params: {
            type: application.TYPE,
            id
        },
        deps
    });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="namespace.application.lookup")');

    return doLookup(params.id, deps);
}

/**
 * NOTE: this checks the context for an associated application if no id specified
 *  - middleware (if configured) populates application
 */
exports.api = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="namespace.application.lookup")');

    if (params.id) return doLookup(params.id, deps);

    if (context.application) return context.application;

    throw new Error('no id parameter supplied; no application associated with request');
}
