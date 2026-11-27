const assert = require('assert');

const { httpError } = require('../../describe');

exports.__metadata = {
    name: 'gell.domain.query',
    description: 'returns a registered named query by name',
    triggers: {
        effect: {
            params: { name: 'string' }
        },
        api: {
            params: { name: 'string' }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing effect (name="gell.domain.query")');

    const { name } = params;

    assert(name, 'name is required');

    return store.queries.describe(name);
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing query is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const query$ = await exports.effect({ params, deps });

    if (!query$) throw httpError(`query not found (name=${params.name})`, 404);

    return query$;
}
