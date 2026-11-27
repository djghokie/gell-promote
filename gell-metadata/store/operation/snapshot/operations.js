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
 * NOTE: reads the store's operation registry (store.operations, a gell-discover Operations)
 */
function listOperations(deps) {
    const { store } = deps.resolve('store');

    return describeAll(store.operations);
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
