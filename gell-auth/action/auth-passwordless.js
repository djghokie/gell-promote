const assert = require('assert');
const _ = require('lodash');

const user = require('../../gell-web/user/snapshot/user-alt');

exports.__metadata = {
    name: 'web.user.auth.passwordless',
    description: 'supports passwordless (TEST_MODE) login',
    triggers: {
        effect: {
            params: {
                userId: {
                    type: 'string',
                    description: 'id used by user to sign into an application; typically email addresss'
                }
            }
        },
    }
}

/**
 * NOTE: USERs are scoped to the APPLICATION, so no TENANT is needed to sign in
 */
async function lookupUser(userId, application, deps) {
    return user.effect({
        params: {
            userId
        },
        context: {
            application
        },
        deps
    })
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.auth.passwordless")');

    const { userId } = params;
    const { application } = context;

    try {
        assert(_.isString(userId), 'userId string is required');
    
        const user_ = await lookupUser(userId, application, deps);
    
        if (user_) return user_.snapshot();
    } catch (e) {
        // NOTE: swallow errors here so they aren't surfaced to the sign page
        logger.error(e.stack);
    }
}
