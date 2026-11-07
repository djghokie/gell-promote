const assert = require('assert');
const _ = require('lodash');

const userLookup = require('../../gell-web/user/snapshot/user-alt');

/**
 * Creates a new NextAuth signIn callback
 *
 * NOTE: credentials providers decide in authorize (no USER => null => refused); Google only proves an email, so the
 * USER is checked here
 *
 * @param {*} application
 * @param {*} deps
 * @returns signIn callback
 */
module.exports = function(application, deps) {
    assert(deps, 'deps is required');

    /**
     * @returns true to allow the sign in, false to refuse it
     */
    return async ({ user, account }) => {
        const { logger } = deps.resolve('logger');

        if (account?.provider !== 'google') return true;

        const user_ = await userLookup.effect({
            params: {
                userId: user.email
            },
            context: {
                application
            },
            deps
        });

        const status = user_?.snapshotAttribute('status');

        if (status === 'AUTHORIZED') return true;

        logger.warn(`sign in refused (provider=google; email=${user.email}; status=${status})`);

        return false;
    }
}
