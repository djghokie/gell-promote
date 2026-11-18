const assert = require('assert');

const execution = require('../domain/execution');

exports.__metadata = {
    name: 'gell.job.execution',
    description: 'returns a JOB EXECUTION by id',
    triggers: {
        effect: {
            params: { id: 'uuid' }
        },
        api: {
            params: { id: 'uuid' }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="gell.job.execution")');

    const { id } = params;

    assert(id, 'id is required');

    const type = types ? types.name(execution.TYPE) : execution.TYPE;

    return store.lookup({ type, id });
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing JOB EXECUTION is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const execution$ = await exports.effect({ params, deps });

    if (!execution$) throw Object.assign(new Error(`job execution not found (id=${params.id})`), { status: 404 });

    return execution$;
}
