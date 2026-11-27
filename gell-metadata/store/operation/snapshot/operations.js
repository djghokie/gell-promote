const { describeAll } = require('../../describe');

exports.__metadata = {
    name: 'gell.domain.operations',
    description: 'returns all registered named operations',
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
 * NOTE: reads the `operations` dependency (a gell-discover Operations registry): the store's own registry
 * (store.operations)
 */
function listOperations(deps) {
    const { operations } = deps.resolve('operations');

    return describeAll(operations);
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.operations")');

    return listOperations(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.operations")');

    return listOperations(deps);
}
