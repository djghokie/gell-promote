const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');

const identity = require('../../identity/snapshot/identity');

exports.__metadata = {
    name: 'web.user.create',
    description: 'creates a new identity associated with an IDENTITY',
    triggers: {
        effect: {},
        action: {
            params: {
                identityId: 'string'
            },
            transaction: 'NEW'
        }
    }
}

/**
 * WIP: could pass in user type (extension of user) here instead
 * 
 * @param {*} applicationType 
 * @param {*} $txn 
 * @param {*} deps 
 * @returns 
 */
async function doCreate(applicationType, identity_, $txn, deps) {
    const user_ = user.materialize({
        type: applicationType,
        id: identity_.snapshotAttribute('id'),
        status: 'AUTHORIZED',
        activeTs: Date.now()
    });

    if ($txn) $txn.next({ operation: 'put', item: user_ });

    return user_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="user.create")');

    throw new Error('NYI');
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="user.create")');

    const { identityId, applicationType } = params;
    const { $txn } = context;

    const identity_ = await identity.effect({
        params: {
            id: identityId
        },
        deps
    });

    return doCreate(applicationType, identity_, $txn, deps);
}
