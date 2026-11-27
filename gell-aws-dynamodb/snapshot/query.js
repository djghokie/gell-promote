const describe = require('../../gell-metadata/snapshot/describe');

exports.__metadata = {
    name: 'store.named.query',
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

    logger.info(`executing api (name="store.named.query"; query=${name})`);

    const query$ = await describe.effect({
        params: { name },
        context: {
            registry_: store.queries
        },
        deps
    });

    if (!query$) throw Object.assign(new Error(`query not found (name=${name})`), { status: 404 });

    return query$;
}
