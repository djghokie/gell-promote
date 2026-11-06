const assert = require('assert');
const _ = require('lodash');

const member = require('../domain/member');

/**
 * NOTE: effect only; used during sign in to resolve the role for the selected TENANT
 */
exports.__metadata = {
    name: 'web.member.lookup',
    description: 'finds the MEMBER for a USER in a TENANT',
    triggers: {
        effect: {
            params: {
                tenantId: 'string',
                userId: 'string'
            }
        },
    }
}

/**
 * NOTE: application (context) namespaces the type, for callers without a namespaced types registry (sign in)
 */
async function lookupMember(tenantId, userId, application, deps) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(member.TYPE, application?.id) : member.TYPE;

    logger.info(`looking up member (tenantId=${tenantId}; userId=${userId}; type=${type})`);

    const [member$] = await store.drain('web.member.userId', { type, parentId: tenantId, userId });

    // NOTE: not types.instance; it would re-namespace the stored type with the registered namespace
    if (member$) return member.materialize(member$);
    else
        logger.warn(`no member (tenantId=${tenantId}; userId=${userId}; type=${type}) found`);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.member.lookup")');

    const { tenantId, userId } = params;
    const { application } = context;

    assert(tenantId, 'tenantId is required');
    assert(userId, 'userId is required');

    return lookupMember(tenantId, userId, application, deps);
}
