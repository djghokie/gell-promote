const assert = require('assert');
const _ = require('lodash');

const user = require('../../gell-web/user/event/create-alt');
const member = require('../../gell-web/member/event/create');

const tenant = require('../../gell-namespace/domain/tenant');
const namespace = require('../../gell-namespace/snapshot/namespace');

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
                    description: 'role assigned to new user in the TENANT'
                },
                tenantId: {
                    type: 'string',
                    description: 'TENANT the new user becomes a MEMBER of (selected on the sign in page)'
                }
            }
        },
    }
}

/**
 * Creates the USER (scoped to the APPLICATION) and its MEMBER (the role) in the TENANT, in one transaction
 *
 * NOTE: web.user.create.alt checks for duplicate user/application combos
 * NOTE: the TENANT is only the new USER's first TENANT; it is selected after sign in, like any other sign in
 *
 * @param {*} userId
 * @param {*} role
 * @param {*} tenantId
 * @param {*} application
 * @param {*} deps
 * @returns
 */
async function createUser(userId, role, tenantId, application={}, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    // NOTE: fails if the TENANT doesn't exist
    const tenant$ = await namespace.effect({ params: { type: tenant.TYPE, id: tenantId }, deps });

    const $txn = store.write();

    const user_ = await user.effect({
        params: {
            email: userId
        },
        context: {
            application,
            $txn
        },
        deps
    });

    await member.effect({
        params: {
            userId: user_.get('userId'),
            role
        },
        context: {
            parent_: tenant.materialize(tenant$),
            namespaceId: application.id,
            $txn
        },
        deps
    });

    await $txn.return().value;

    logger.info(`created test user (userId=${userId}; role=${role}; tenantId=${tenantId})`);

    return user_.snapshot();
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.user.auth.newuser")');

    const { userId, role, tenantId } = params;
    const { application } = context;

    try {
        assert(_.isString(userId), 'userId string is required');
        assert(_.isString(role), 'role string is required');
        assert(_.isString(tenantId), 'tenantId string is required');

        return await createUser(userId, role, tenantId, application, deps);
    } catch (e) {
        // NOTE: swallow errors here so they aren't surfaced to the sign page
        logger.error(e.stack);
    }
}
