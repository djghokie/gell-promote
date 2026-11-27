const describe = require('../../../snapshot/describe');

const { httpError } = require('../../describe');

exports.__metadata = {
    name: 'gell.domain.operation',
    description: 'describes a registered named operation',
    triggers: {
        api: {
            params: { name: 'string' }
        }
    }
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so an unknown operation is reported as a 404
 */
exports.api = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    const { name } = params;

    logger.info(`executing api (name="gell.domain.operation"; operation=${name})`);

    const operation$ = await describe.effect({
        params: { name },
        context: {
            registry_: store.operations
        },
        deps
    });

    if (!operation$) throw httpError(`operation not found (name=${name})`, 404);

    return operation$;
}
