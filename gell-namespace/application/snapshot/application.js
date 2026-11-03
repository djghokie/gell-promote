const assert = require('assert');

const application = require('gell-promote/gell-namespace/domain/application');
const namespace = require('gell-promote/gell-namespace/snapshot/namespace');

// NOTE: id is a string, not a uuid: the seeded admin APPLICATION has a readable id (BLUEHOURINCUBATOR#APP#ADMIN)
exports.__metadata = {
    name: 'namespace.application.lookup',
    description: 'returns an APPLICATION by id',
    triggers: {
        api: {
            params: { id: 'string' }
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

    logger.info('executing effect (name="application.lookup")');

    return doLookup(params.id, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="application.lookup")');

    return doLookup(params.id, deps);
}
