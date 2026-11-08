const assert = require('assert');
const _ = require('lodash');

const member = require('../domain/member');

/**
 * NOTE: effect only for now; the TENANT picker (api) must use the signed in USER, not a userId param
 */
exports.__metadata = {
    name: 'web.memberships',
    description: 'returns the active MEMBERs (one per TENANT) of a USER',
    triggers: {
        effect: {
            params: {
                userId: 'string'
            }
        },
    }
}

/**
 * NOTE: application (context) namespaces the type; otherwise the registered (APPLICATION) namespace is used
 */
async function fetchMemberships(userId, application, deps) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(member.TYPE, application?.id) : member.TYPE;

    logger.info(`fetching memberships (userId=${userId}; type=${type})`);

    return store.drain('web.members.userId', { type, userId });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.memberships")');

    const { userId } = params;
    assert(userId, 'userId is required');

    return fetchMemberships(userId, context.application, deps);
}
