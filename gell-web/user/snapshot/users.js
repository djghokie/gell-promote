const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'web.users',
    description: '"web.users" event',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.users")');

    throw new Error('NYI');
}

exports.api = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing api (name="web.users")');

    const { applicationId } = params;

    return store.drain('sessions.active.type', { type: applicationId });
}