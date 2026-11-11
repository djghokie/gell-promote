const assert = require('assert');
const _ = require('lodash');

const application = require('../../../gell-namespace/domain/application');
const tenant = require('../../../gell-namespace/domain/tenant');
const namespace = require('../../../gell-namespace/snapshot/namespace');

const userCreate = require('../../user/event/create');
const userLookup = require('../../user/snapshot/user');

const memberCreate = require('./create');

/**
 * NOTE: the TENANT is the caller's (session) TENANT and the APPLICATION is the request's APPLICATION namespace (set by
 * the API middleware), so neither is a param
 */
exports.__metadata = {
    name: 'web.member.add',
    description: 'adds a USER to the caller\'s TENANT: creates the USER (when missing) and its MEMBER',
    triggers: {
        action: {
            params: {
                email: 'string',
                role: 'string'
            },
            transaction: 'NEW'
        }
    }
}

/**
 * WIP: the APPLICATION comes from the types registry's APPLICATION namespace; the session doesn't carry it yet
 */
async function resolveApplication(deps) {
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const applicationId = types?.get('namespace', 'APPLICATION');

    assert(_.isString(applicationId), 'APPLICATION namespace is required');

    return namespace.effect({ params: { type: application.TYPE, id: applicationId }, deps });
}

async function findOrCreateUser(email, application$, $txn, deps) {
    const user_ = await userLookup.effect({
        params: { userId: email },
        context: { application: application$ },
        deps
    });

    if (user_) return user_;

    return userCreate.effect({
        params: { email },
        context: { application: application$, $txn },
        deps
    });
}

exports.action = async function({ params={}, context={}, caller, deps }) {
    const { logger } = deps.resolve('logger');
    const { $txn } = context;

    logger.info('executing action (name="web.member.add")');

    const { email, role } = params;

    assert(_.isString(email) && email, 'email is required');
    assert(_.isString(role) && role, 'role is required');

    const tenantId = caller?.snapshotAttribute('tenantId');
    assert(tenantId, 'caller tenantId is required');

    const normalized = email.trim().toLowerCase();

    const application$ = await resolveApplication(deps);
    const tenant$ = await namespace.effect({ params: { type: tenant.TYPE, id: tenantId }, deps });

    const user_ = await findOrCreateUser(normalized, application$, $txn, deps);

    return memberCreate.effect({
        params: {
            userId: user_.get('userId'),
            role
        },
        context: {
            parent_: tenant.materialize(tenant$),
            namespaceId: application$.id,
            $txn
        },
        deps
    });
}
