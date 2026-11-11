const assert = require('assert');

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
    const { logger, queries } = deps.resolve('logger', 'queries');

    logger.info('executing effect (name="gell.domain.query")');

    const { name } = params;

    assert(name, 'name is required');

    return queries.describe(name);
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing QUERY is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const query$ = await exports.effect({ params, deps });

    if (!query$) throw Object.assign(new Error(`query not found (name=${params.name})`), { status: 404 });

    return query$;
}
