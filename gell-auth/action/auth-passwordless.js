const assert = require('assert');
const _ = require('lodash');

const user = require('../../gell-web/user/snapshot/user-alt');
// const user = require('gell-web/domain/user');

/**
 * WIP: supports passwordless auth CredentialProvider
 *  - this may be split up into multiple actions
 *  - needs to support namespaced and non-namespaced ecosystems
 */
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
 * creates an AUTHORIZED USER on the fly (same shape as bhi-job/seed/admin.js)
 *
 * NOTE: refuses to overwrite an existing USER so a typo can't clobber a seeded user's roles
 */
async function createUser(applicationId, email, role, deps) {
    assert(isTestMode(), 'user creation is only allowed in TEST_MODE');

    const { logger, store } = deps.resolve('logger', 'store');

    const $txn = store.write();

    const user_ = await userAdd.effect({
        params: {
            email,
            role
        },
        context: {
            $txn
        },
        deps
    });

    await $txn.return().value;

    logger.info(`created test user (email=${email}; role=${role}; application=${applicationId})`);

    return user_;
}

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

    const { userId, role } = params;
    const { application } = context;

    try {
        assert(_.isString(userId), 'userId string is required');
    
        if (role) return createUser(applicationId, email, role, deps);
    
        const user_ = await lookupUser(userId, application, deps);
    
        if (user_) return user_.snapshot();
    } catch (e) {
        // NOTE: swallow errors here so they aren't surfaced to the sign page
        logger.error(e.stack);
    }
}
