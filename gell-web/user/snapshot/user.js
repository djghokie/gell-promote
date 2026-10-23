const assert = require('assert');
const _ = require('lodash');

const lookup = require('gell-session/snapshot/lookup');
const user = require('gell-web/domain/user');

const identity = require('../../identity/snapshot/identity');

exports.__metadata = {
    name: 'web.user.lookup',
    description: 'returns USER associated with an application',
    triggers: {
        effect: {
            params: {
                applicationId: {
                    type: 'string',
                    optional: true
                }
            },
            context: {
                identity_: 'state'
            }
        },
        api: {
            params: {
                identityId: 'string',
                applicationId: {
                    type: 'string',
                    optional: true
                }
            }
        }
    }
}

/**
 * Returns the USER of an IDENTITY for an application, or undefined if none
 *  - USER is a child of the IDENTITY (parentId) with type of the application
 *
 * @param {*} identity_
 * @param {*} applicationId
 * @param {*} deps
 */
async function doLookup(identity_, applicationId, deps) {
    const { store } = deps.resolve('store');

    const identityId = identity_.snapshotAttribute('id');
    const type = applicationId || user.TYPE;

    const users$ = await store.drain('session.children', { type, parentId: identityId });

    if (users$.length > 1) throw new Error(`multiple users associated with identity (identityId=${identityId}; applicationId=${applicationId})`);
    if (users$.length === 1) return user.materialize(users$[0]);

    /**
     * WIP: legacy USERs use the IDENTITY id as their id (no parentId)
     *  - remove once existing USERs are migrated
     */
    return lookup.effect({
        params: {
            key: {
                type,
                id: identityId
            }
        },
        context: {
            materialize: user.materialize
        },
        deps
    });
}

/**
 * Returns the USER of the IDENTITY (context) for an application, or undefined if the IDENTITY has no USER
 */
exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.lookup")');

    const { applicationId } = params;
    const { identity_ } = context;

    assert(identity_, 'identity_ is required');

    return doLookup(identity_, applicationId, deps);
}

/**
 * Returns the USER of an IDENTITY for an application
 *  - an UNAUTHORIZED USER (not persisted) if the IDENTITY does not exist or has no USER for the application
 *
 * WIP: currently using status for user that is not authorized for an application
 *  - could use empty roles instead tho
 */
exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="web.user.lookup")');

    const { identityId, applicationId } = params;

    const identity_ = await identity.effect({
        params: {
            id: identityId,
            failIfNotFound: false
        },
        deps
    });

    const user_ = identity_ && await doLookup(identity_, applicationId, deps);

    if (user_) return user_;

    return user.materialize({
        type: applicationId,
        parentId: identityId,
        status: 'UNAUTHORIZED',
    });
}
