const { describeAll } = require('../../describe');

exports.__metadata = {
    name: 'gell.domain.queries',
    description: 'returns all registered named queries',
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
 * NOTE: reads the store's query registry (store.queries, a gell-discover Queries)
 */
function listQueries(deps) {
    const { store } = deps.resolve('store');

    return describeAll(store.queries);
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.queries")');

    return listQueries(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.queries")');

    return listQueries(deps);
}
