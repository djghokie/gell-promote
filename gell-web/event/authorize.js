const assert = require('assert');
const _ = require('lodash');

const userLookup = require('../user/snapshot/user');

/**
 * WIP: new approach
 *  - type would be specific to the app
 *      - PEAKSHUTTLE#APP#OPERATIONS
 *  - USER is a child of the IDENTITY (parentId); id is generated (see web.user.lookup)
 */
exports.__metadata = {
    name: 'user.authorize',
    description: 'authorizes a USER to access an application',
    triggers: {
        effect: {},
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="user.authorize")');

    const { applicationType } = params;
    assert(applicationType);

    const { identity_ } = context;
    assert(identity_);

    const user_ = await userLookup.effect({
        params: {
            applicationId: applicationType
        },
        context: {
            identity_
        },
        deps
    });

    assert(user_);

    return user_;
}
