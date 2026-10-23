const assert = require('assert');

const lookup = require('gell-session/snapshot/lookup');

exports.__metadata = {
    name: 'namespace.lookup',
    description: 'returns a NAMESPACE by id',
    triggers: {
        effect: {
            params: { id: 'string' }
        },
        api: {
            params: { id: 'string' }
        }
    }
}

async function doLookup(type, id, deps) {
    const { types } = deps.resolve('types');

    const name = types.name(type);

    return lookup.effect({
        params: {
            key: {
                type: name,
                id
            },
            failIfNotFound: true
        },
        deps
    });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="namespace.lookup")');

    const { type, id } = params;

    return doLookup(type, id, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="namespace.lookup")');

    return doLookup(params.id, deps);
}
