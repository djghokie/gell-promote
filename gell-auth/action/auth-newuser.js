const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');
const userLookup = require('../../gell-web/user/snapshot/user-alt');

/**
 * WIP: supports newuser auth CredentialProvider
 *  - this may be split up into multiple actions
 *  - needs to support namespaced and non-namespaced ecosystems
 */
exports.__metadata = {
    name: 'web.user.auth.newuser',
    description: 'supports newuser (TEST_MODE) login',
    triggers: {
        effect: {
            params: {
                userId: {
                    type: 'string',
                    description: 'userId for new user; typically email addresss'
                },
                role: {
                    type: 'string',
                    description: 'role assigned to new user'
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
async function createUser(userId, role, application={}, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    /**
     * WIP: user create needs to be re-implemented
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
    */

    const { namespaceId } = application;

    if (namespaceId)
        var type = `${namespaceId}::${user.TYPE}`;

    const user_ = user.materialize({
        type,

        userId,
        email: userId,
        roles: [role]
    })

    await store.save(user_);

    logger.info(`created test user (userId=${userId}; role=${role})`);

    return user_.snapshot();
}

async function lookupUser(userId, application, deps) {
    const user_ = await userLookup.effect({
        params: {
            userId
        },
        context: {
            application
        },
        deps
    })

    if (user_) throw new Error(`user (userId=${userId}) already exists`);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.auth.passwordless")');

    const { userId, role } = params;
    const { application } = context;

    try {
        assert(_.isString(userId), 'userId string is required');
        assert(_.isString(role), 'role string is required');
    
        await lookupUser(userId, application, deps);

        return createUser(userId, role, application, deps);
    } catch (e) {
        // NOTE: swallow errors here so they aren't surfaced to the sign page
        logger.error(e.stack);
    }
}
