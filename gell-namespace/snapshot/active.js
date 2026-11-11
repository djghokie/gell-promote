const assert = require('assert');
const _ = require('lodash');

const namespace = require('gell-promote/gell-namespace/domain/namespace');

exports.__metadata = {
    name: 'namespaces.active',
    description: 'returns all active NAMESPACEs',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

async function fetchNamespaces(type, deps) {
    const { logger, store, types } = deps.resolve('logger', 'store');
    // const { logger, store, types } = deps.resolve('logger', 'store', 'types');

    logger.info(`retrieving tenants (type=${type})`);

    return store.drain('sessions.activity.type', { type });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="namespaces.active")');

    const { type } = params;

    return fetchNamespaces(type, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="namespaces.active")');

    // const type = types.name(namespace.TYPE);
    const type = namespace.TYPE;

    return fetchNamespaces(type, deps);
}
