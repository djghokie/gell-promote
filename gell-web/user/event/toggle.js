const assert = require('assert');
const _ = require('lodash');

const update = require('gell-session/event/update');

const identity = require('../../identity/snapshot/identity');
const user = require('../snapshot/user');

exports.__metadata = {
    name: 'web.role.toggle',
    description: 'toggle USER role',
    triggers: {
        effect: {},
        action: {
            params: {
                identityId: 'string',
                applicationId: 'string',
                role: 'string'
            },
            transaction: 'NEW'
        }
    }
}

async function doToggle(user_, role, $txn, deps) {
    const existingRoles = user_.snapshotAttribute('roles') || [];
    const roleIndex = existingRoles.findIndex(r => r === role);
    const newRoles = [...existingRoles];
    if (roleIndex < 0) newRoles.push(role)
    else newRoles.splice(roleIndex, 1);

    await update.effect({
        params: {
            attribute: 'roles',
            value: newRoles
        },
        context: {
            session_: user_,
            $txn
        },
        deps
    });

    return user_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.role.toggle")');

    const { role } = params;
    const { user_ } = context;

    return doToggle(user_, role, context.$txn, deps);
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="web.role.toggle")');

    const { identityId, applicationId, role } = params;

    const identity_ = await identity.effect({
        params: {
            id: identityId
        },
        deps
    });

    const user_ = await user.effect({
        params: {
            applicationId
        },
        context: {
            identity_
        },
        deps
    });

    // NOTE: roles can only be toggled for an existing USER (see web.user.create)
    assert(user_, `no user (identityId=${identityId}; applicationId=${applicationId})`);

    return doToggle(user_, role, context.$txn, deps);
}
