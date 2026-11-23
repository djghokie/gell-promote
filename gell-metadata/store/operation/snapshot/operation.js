const assert = require('assert');

const { httpError } = require('../../describe');

exports.__metadata = {
    name: 'gell.domain.operation',
    description: 'returns a registered named operation by name',
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
    const { logger, operations } = deps.resolve('logger', 'operations');

    logger.info('executing effect (name="gell.domain.operation")');

    const { name } = params;

    assert(name, 'name is required');

    return operations.describe(name);
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing operation is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const operation$ = await exports.effect({ params, deps });

    if (!operation$) throw httpError(`operation not found (name=${params.name})`, 404);

    return operation$;
}
