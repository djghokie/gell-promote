const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');

/**
 * WIP: new approach
 *  - type would be specific to the app
 *      - PEAKSHUTTLE#APP#OPERATIONS
 *  - id would be the identity id (email)
 */
exports.__metadata = {
    name: 'user.authorize',
    description: 'authorizes a USER to access an application',
    triggers: {
        effect: {},
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing effect (name="user.authorize")');

    const { applicationType } = params;
    assert(applicationType);
    
    const { identity_ } = context;
    assert(identity_);

    const { id } = identity_.snapshot();

    const user$ = await store.lookup({ type: applicationType, id });

    assert(user$);

    return user.materialize(user$);
}
