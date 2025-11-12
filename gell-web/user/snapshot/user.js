const assert = require('assert');
const _ = require('lodash');

const lookup = require('gell-session/snapshot/lookup');
const user = require('gell-web/domain/user');

exports.__metadata = {
    name: 'web.user.lookup',
    description: 'returns USER associated with an application',
    triggers: {
        effect: {},
        api: {
            params: {
                identityId: 'string'
            }
        }
    }
}

/**
 * WIP: currently using status for user that is not authorized for an application
 *  - could use empty roles instead tho
 * 
 * @param {*} identityId 
 * @param {*} applicationId 
 * @param {*} deps 
 * @returns 
 */
async function doLookup(identityId, applicationId, deps) {
    const user_ = await lookup.effect({
        params: {
            key: {
                type: applicationId || user.TYPE,
                id: identityId
            }
        },
        context: {
            materialize: user.materialize
        },
        deps
    });

    if (user_) return user_;

    return user.materialize({
        type: applicationId,
        id: identityId,
        status: 'UNAUTHORIZED',
    });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.lookup")');

    const { identityId, applicationId } = params;

    return doLookup(identityId, applicationId, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="web.user.lookup")');

    const { identityId, applicationId } = params;

    return doLookup(identityId, applicationId, deps);
}