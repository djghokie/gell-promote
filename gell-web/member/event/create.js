const assert = require('assert');
const _ = require('lodash');

const { createInitiate } = require('../../../gell-session/util/event');

const member = require('../domain/member');

/**
 * NOTE: parentId is the TENANT's id; userId is the USER's userId
 * NOTE: the effect takes the TENANT as context.parent_ and accepts context.namespaceId (the APPLICATION's id) for
 * callers without a namespaced types registry (sign in, jobs)
 */
const __metadata = {
    name: 'web.member.create',
    description: 'creates a MEMBER: a USER\'s membership in a TENANT',
    triggers: {
        effect: {
            params: {
                userId: 'string',
                role: 'string'
            },
            transaction: 'JOIN'
        },
        action: {
            params: {
                parentId: 'string',
                userId: 'string',
                role: 'string'
            },
            transaction: 'NEW'
        }
    }
}

/**
 * WIP: the USER isn't checked; it may be created in the same transaction (newuser sign in)
 * WIP: duplicates within one uncommitted transaction aren't detected
 */
async function validate({ session$, deps }) {
    const { store } = deps.resolve('store');

    const { type, parentId, userId, role } = session$;

    assert(_.isString(userId) && userId, 'userId is required');
    assert(_.isString(role) && role, 'role is required');

    const [existing$] = await store.drain('web.member.userId', { type, parentId, userId });

    assert(!existing$, `member already exists (userId=${userId}; tenantId=${parentId})`);
}

module.exports = createInitiate(__metadata, member, { activate: true, validate });
