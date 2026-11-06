const assert = require('assert');
const _ = require('lodash');

const userLookup = require('../../gell-web/user/snapshot/user-alt');

/**
 * Creates a new NextAuth jwt callback
 * 
 * NOTE: namespaceId is required and commonly references the tenant the user belongs to
 *  - it is left to the UI to determine what the tenant is
 *  - tenant can be determined by a variety of methods
 *      - selected explicitly by the user (not common in production applications)
 *      - vanity URL/domain name
 * 
 * @param {*} application 
 * @param {*} namespaceId 
 * @param {*} deps 
 * @returns jwt callback
 */
module.exports = function(application, deps) {
    assert(deps, 'deps is required');

    /**
     * Populates JWT token by exposing values from JWT token
     * 
     * WIP: this is subject to change and hasn't been fully thought out yet
     *  - role is probably needed to authorize API calls
     *  - user.id is probably easiest way to link session to user item
     * 
     * WIP: user can be assigned multiple roles
     *  - unclear how this would be used
     *  - potentially would allow sign in as a user specified role
     *  - for now, only first role is used
     * 
     * ARGUMENTS:
     *  - token represents the JWT
     *  - account
     *      - only populated on sign in
     * 
     * @returns object mapping to JWT token
     */
    return async ({ token, user, account }) => {
        // console.debug('##### jwt', token, user, account);

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

            // WIP: USERs no longer hold roles; the role comes from the selected TENANT's MEMBER (user-auth increment 4)
            if (user_) {
                const roles = user_.snapshotAttribute('roles');
                if (roles?.length > 0) token.role = roles[0];
            }
        } else if (user) {
            token.userId = user.userId;
            token.email = user.email;
            token.applicationId = user.parentId;
            if (user.roles?.length > 0) token.role = user.roles[0];
        }

        return token;
    }

}