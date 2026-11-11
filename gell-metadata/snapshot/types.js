const type = require('gell-promote/gell-discover/domain/type');

exports.__metadata = {
    name: 'gell.domain.types',
    description: 'returns all registered domain TYPEs with the namespace each is registered with',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

/**
 * WIP: the registry only keeps the TYPE name (gell-discover type.materialize drops the model's attributes)
 *  - expose attributes/extends once the registry compiles types
 *
 * WIP: reads namespacedTypes directly; the registry should expose an accessor for a TYPE's namespace
 */
exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="gell.domain.types")');

    // NOTE: without the types registry no TYPEs are registered
    if (!types) return [];

    return Array.from(types.names())
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({ name, namespace: types.namespacedTypes[name] }))
        ;
}

exports.api = exports.effect;
