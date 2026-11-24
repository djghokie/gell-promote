const assert = require('assert');
const _ = require('lodash');

const namespace = require('../domain/namespace');

exports.__metadata = {
    name: 'namespaces.active',
    description: 'returns all active NAMESPACEs',
    triggers: {
        effect: {},
        api: {
            params: {},
            extension: {
                types: ['GELL#NAMESPACE'],
            },
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

/**
 * NOTE: dispatched as a stereotyped event (e.g. APPLICATION$namespaces.active#api); the type is the extension's
 * GELL#NAMESPACE type (resolved by gell-stereotype's extension middleware), namespaced through the types registry when
 * it is registered there
 */
exports.api = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing api (name="namespaces.active")');

    const { name } = context.extensionTypes['GELL#NAMESPACE'];

    // const type = types.name(namespace.TYPE);
    const type = types && types.get(name) ? types.name(name) : name;

    return fetchNamespaces(type, deps);
}
