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
 * NOTE: reads the operation registry (<prefix>-integration/dependencies/operations.js), which the store's
 * namedOperations are built from
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, operations } = deps.resolve('logger', 'operations');

    logger.info('executing effect (name="gell.domain.operations")');

    return Array.from(operations.names())
        .map(name => operations.describe(name))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.api = exports.effect;
