const assert = require('assert');
const _ = require('lodash');

const activate = require('gell-session/event/activate');

const user = require('gell-web/domain/user');

const applicationLookup = require('../../../gell-namespace/snapshot/namespace');
const application = require('../../../gell-namespace/domain/application');

const userLookup = require('../snapshot/user-alt');

/**
 * WIP: re-implementation of user create action
 *  - currently passing in email; this may change to userId
 *
 * NOTE: a USER is the identity in an APPLICATION (parentId), with its type namespaced by the APPLICATION
 *  - roles are not held by the USER; a USER's role in a TENANT is its MEMBER (web.member.create)
 */
exports.__metadata = {
    name: 'web.user.create.alt',
    description: 'creates a new USER',
    triggers: {
        effect: {
            params: {
                email: 'string',
            },
            transaction: 'JOIN'
        },
        action: {
            params: {
                email: 'string',
                applicationId: {
                    type: 'string',
                    optional: true
                },
            },
            transaction: 'NEW'
        }
    }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Determines which application to associate with the user to be created
 *  - applicationId is checked first
 * 
 * WIP: unclear if support is needed for application passed through context (middlewware populated)
 * 
 * @param {*} applicationId 
 * @param {*} caller 
 * @param {*} deps 
 */
async function resolveApplication(applicationId, caller, context, deps) {
    const { logger } = deps.resolve('logger');

    if (applicationId) {
        return applicationLookup.effect({
            params: {
                type: application.TYPE,
                id: applicationId
            },
            deps
        });
    }

    const parentId = caller.snapshotAttribute('parentId');

    if (parentId) {
        return applicationLookup.effect({
            params: {
                type: application.TYPE,
                id: parentId
            },
            deps
        });
    }

    if (context.application) return context.application;

    logger.warn('no application associated with request; user will be created in default namespace');
}

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

    if (user_) {
        throw new Error(`user (userId=${userId}) already exists`);
    }
}

/**
 * NOTE: the type is namespaced by the APPLICATION's id; without an APPLICATION, the registered namespace is used
 */
async function doCreate(email, application, $txn, deps) {
    const { logger } = deps.resolve('logger');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    assert(_.isString(email), 'email parameter must be a string');
    const normalizedEmail = email.trim().toLowerCase();
    assert(EMAIL_PATTERN.test(normalizedEmail), `email is invalid (email=${normalizedEmail})`);

    if (application) var applicationId = application.id; 

    const type = types ? types.name(user.TYPE, applicationId) : user.TYPE;

    await lookupUser(normalizedEmail, application, deps);

    logger.info(`creating user (type=${type}; userId=${normalizedEmail})`);

    const user_ = user.materialize({
        type,
        userId: normalizedEmail,
        email: normalizedEmail,
        status: 'AUTHORIZED',
        parentId: applicationId,
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

    const { email } = params;
    const { application, $txn } = context;

    return doCreate(email, application, $txn, deps);
}

/**
 * WIP: should this guard against creating user's outside of ecosystem?
 */
exports.action = async function({ params={}, context={}, caller, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="web.user.create.alt")');

    const { email, applicationId } = params;
    const { $txn } = context;

    const application = await resolveApplication(applicationId, caller, context, deps);

    return doCreate(email, application, $txn, deps);
}