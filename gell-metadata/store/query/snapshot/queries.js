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
 * NOTE: reads the `queries` dependency (a gell-discover Queries registry): the store's own registry
 * (store.queries)
 */
function listQueries(deps) {
    const { queries } = deps.resolve('queries');

    return describeAll(queries);
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
