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
 * NOTE: reads the query registry (<prefix>-integration/dependencies/queries.js), which the store's namedQueries
 * are built from; queries added directly to store.namedQueries (e.g. the ut-only web.user) are not listed
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, queries } = deps.resolve('logger', 'queries');

    logger.info('executing effect (name="gell.domain.queries")');

    return Array.from(queries.names())
        .map(name => queries.describe(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.api = exports.effect;
