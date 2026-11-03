const assert = require('assert');

const lookup = require('gell-session/snapshot/lookup');

const tenant = require('gell-promote/gell-namespace/domain/tenant');

exports.__metadata = {
    name: 'namespace.tenant.lookup',
    description: 'returns a TENANT by id',
    triggers: {
        effect: {
            params: { id: 'string' }
        },
        api: {
            params: { id: 'string' }
        }
    }
}

async function doLookup(id, deps) {
    const { types } = deps.resolve('types');

    const type = types.name(tenant.TYPE);

    return lookup.effect({
        params: {
            key: {
                type,
                id
            },
            failIfNotFound: true
        },
        deps
    });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="tenant.lookup")');

    return doLookup(params.id, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="tenant.lookup")');

    return doLookup(params.id, deps);
}
