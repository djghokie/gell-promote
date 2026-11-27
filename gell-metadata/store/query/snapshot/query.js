const describe = require('../../../snapshot/describe');

const { httpError } = require('../../describe');

exports.__metadata = {
    name: 'gell.domain.query',
    description: 'describes a registered named query',
    triggers: {
        api: {
            params: { name: 'string' }
        }
    }
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so an unknown query is reported as a 404
 */
exports.api = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    const { name } = params;

    logger.info(`executing api (name="gell.domain.query"; query=${name})`);

    const query$ = await describe.effect({
        params: { name },
        context: {
            registry_: store.queries
        },
        deps
    });

    if (!query$) throw httpError(`query not found (name=${name})`, 404);

    return query$;
}
