const assert = require('assert');
const _ = require('lodash');

const userLookup = require('../../gell-web/user/snapshot/user');
const memberLookup = require('../../gell-web/member/snapshot/member');

/**
 * Exposes the USER's identity in the token
 *
 * NOTE: sub is the USER's id for every provider (for Google, next-auth sets it to the Google account id)
 */
function setIdentity(token, user$) {
    token.sub = user$.id;
    token.userId = user$.userId;
    token.email = user$.email;
    token.applicationId = user$.parentId;
}

/**
 * Selects the TENANT: the role is the USER's MEMBER role in that TENANT
 *
 * NOTE: the client only names the TENANT (useSession().update({ tenantId })); the MEMBER is looked up here, server
 * side, so the client can't choose its role
 *  - no MEMBER (or no tenantId) clears both the TENANT and the role
 */
async function selectTenant(token, tenantId, application, deps) {
    const { logger } = deps.resolve('logger');

    delete token.tenantId;
    delete token.role;

    if (!tenantId || !token.userId) return;

    const member_ = await memberLookup.effect({
        params: {
            tenantId,
            userId: token.userId
        },
        context: {
            application
        },
        deps
    });

    if (!member_) {
        logger.warn(`tenant not selected; no member (tenantId=${tenantId}; userId=${token.userId})`);
        return;
    }

    token.tenantId = tenantId;
    token.role = member_.get('role');

    logger.info(`tenant selected (tenantId=${tenantId}; userId=${token.userId}; role=${token.role})`);
}

/**
 * Creates a new NextAuth jwt callback
 *
 * NOTE: the USER is scoped to the APPLICATION, so sign in doesn't need a TENANT
 *  - the TENANT (and the role that comes with it) is selected after sign in, with useSession().update({ tenantId })
 *  - it is left to the UI to determine what the tenant is
 *  - tenant can be determined by a variety of methods
 *      - selected explicitly by the user (not common in production applications)
 *      - vanity URL/domain name
 *
 * @param {*} application
 * @param {*} deps
 * @returns jwt callback
 */
module.exports = function(application, deps) {
    assert(deps, 'deps is required');

    /**
     * Populates JWT token
     *
     * WIP: this is subject to change and hasn't been fully thought out yet
     *  - role is probably needed to authorize API calls
     *  - user.id is probably easiest way to link session to user item
     *
     * WIP: a role change or a removed MEMBER isn't picked up until the next update() or sign in
     *
     * ARGUMENTS:
     *  - token represents the JWT
     *  - user, account
     *      - only populated on sign in
     *  - trigger, session
     *      - trigger is "update" (and session is the data passed to update()) when the client calls update()
     *
     * @returns object mapping to JWT token
     */
    return async ({ token, user, account, trigger, session }) => {
        if (account && account.provider === 'google') {
            // NOTE: USERs are scoped to the APPLICATION, so the email is enough to find the USER
            const user_ = await userLookup.effect({
                params: {
                    userId: user.email
                },
                context: {
                    application
                },
                deps
            });

            // NOTE: the signIn callback refuses a Google sign in without a USER
            if (user_) setIdentity(token, user_.snapshot());
        } else if (user) {
            setIdentity(token, user);
        }

        if (trigger === 'update' && session && 'tenantId' in session) {
            await selectTenant(token, session.tenantId, application, deps);
        }

        return token;
    }

}
