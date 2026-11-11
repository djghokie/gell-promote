const assert = require('assert');
const _ = require('lodash');

const member = require('../domain/member');

exports.__metadata = {
    name: 'web.members',
    description: 'returns the active MEMBERs of a TENANT',
    triggers: {
        effect: {
            params: {
                tenantId: 'string'
            }
        },
        api: {}
    }
}

/**
 * NOTE: application (context) namespaces the type; otherwise the registered (APPLICATION) namespace is used
 */
async function fetchMembers(tenantId, application, deps) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(member.TYPE, application?.id) : member.TYPE;

    logger.info(`fetching members (tenantId=${tenantId}; type=${type})`);

    return store.drain('session.children.active', { type, parentId: tenantId });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.members")');

    const { tenantId } = params;
    assert(tenantId, 'tenantId is required');

    return fetchMembers(tenantId, context.application, deps);
}

/**
 * NOTE: api returns the MEMBERs of the caller's (session) TENANT only
 */
exports.api = async function({ caller, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="web.members")');

    const tenantId = caller?.snapshotAttribute('tenantId');
    assert(tenantId, 'caller tenantId is required');

    return fetchMembers(tenantId, undefined, deps);
}
