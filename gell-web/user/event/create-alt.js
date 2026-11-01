const assert = require('assert');
const _ = require('lodash');

const activate = require('gell-session/event/activate');

const user = require('gell-web/domain/user');

const userLookup = require('../snapshot/user-alt');

/**
 * WIP: re-implementation of user create action
 *  - currently passing in email; this may change to userId
 */
exports.__metadata = {
    name: 'web.user.create.alt',
    description: 'creates a new USER',
    triggers: {
        effect: {
            params: {
                email: 'string',
                role: 'string',
            },
            transaction: 'JOIN'
        },
        action: {
            params: {
                email: 'string',
                role: 'string',
            },
            transaction: 'NEW'
        }
    }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function lookupUser(userId, application, deps) {
    const user_ = await userLookup.effect({
        params: {
            userId,
        },
        context: {
            application
        },
        deps
    })

    if (user_) throw new Error(`user (userId=${userId}) already exists`);
}

async function doCreate(email, role, application, $txn, deps) {
    const { logger } = deps.resolve('logger');

    assert(_.isString(email), 'email parameter must be a string');
    const normalizedEmail = email.trim().toLowerCase();
    assert(EMAIL_PATTERN.test(normalizedEmail), `email is invalid (email=${normalizedEmail})`);

    assert(_.isString(role), 'role is required');

    if (application) {
        var type = `${application.id}::${user.TYPE}`;
    } else {
        var type = user.TYPE;

        logger.warn(`user (email=${email}) will not be namespaced; system is single tenant`);
    }

    await lookupUser(normalizedEmail, application, deps);

    logger.info(`creating user (type=${type}; userId=${normalizedEmail})`);

    const user_ = user.materialize({
        type,
        userId: normalizedEmail,
        email: normalizedEmail,
        roles: [role],
        status: 'AUTHORIZED',
    });

    await activate.effect({
        context: {
            session_: user_
        },
        deps
    });

    if ($txn) $txn.next({ operation: 'put', item: user_ });

    return user_;
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.create.alt")');

    const { email, role } = params;
    const { application, $txn } = context;

    return doCreate(email, role, application, $txn, deps);
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="web.user.create.alt")');

    const { email, role } = params;
    const { application, $txn } = context;

    return doCreate(email, role, application, $txn, deps);
}