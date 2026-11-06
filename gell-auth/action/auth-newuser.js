const assert = require('assert');
const _ = require('lodash');

const user = require('../../gell-web/user/event/create-alt');

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
 * WIP: role isn't assigned yet; it belongs to a MEMBER of the TENANT selected on the sign in page (user-auth increment 4)
 * 
 * @param {*} userId 
 * @param {*} role 
 * @param {*} application 
 * @param {*} deps 
 * @returns 
 */
async function createUser(userId, role, application={}, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    /**
     * NOTE
     *  - this checks for duplicate user/application combos
     *  - avoid managing transaction; requires save after
     */
    const user_ = await user.effect({
        params: {
            email: userId
        },
        context: {
            application
        },
        deps
    });

    await store.save(user_);

    logger.info(`created test user (userId=${userId}; role=${role})`);

    return user_.snapshot();
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.auth.passwordless")');

    const { userId, role } = params;
    const { application } = context;

    try {
        assert(_.isString(userId), 'userId string is required');
        assert(_.isString(role), 'role string is required');
    
        return await createUser(userId, role, application, deps);
    } catch (e) {
        // NOTE: swallow errors here so they aren't surfaced to the sign page
        logger.error(e.stack);
    }
}
