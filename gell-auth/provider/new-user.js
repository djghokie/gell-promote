import assert from 'node:assert';

import CredentialsProvider from 'next-auth/providers/credentials';

import auth from '../action/auth-newuser';

/**
 * Create a new instance of the "new user" credentials provider
 * 
 * NOTES
 *  - used in non-production scenarios to sign in as a newly created user
 *  - creates and persists new user on the fly, as a MEMBER (with the role) of the TENANT
 *  - could potentially pass in id and/or name as arguments
 */
export default function newUserProvider(application, deps) {
    assert(deps, 'deps is required');

    return CredentialsProvider({
        id: 'newuser',

        name: 'New User Credentials Provider',

        credentials: {
            email: {
                label: 'Email',
                type: 'email',
                placeholder: 'your@email.com'
            },
            role: {
                label: 'Role',
                type: 'text'
            },
            tenantId: {
                label: 'Tenant',
                type: 'text'
            },
        },

        async authorize(credentials) {
            return auth.effect({
                params: credentials,
                context: {
                    application
                },
                deps
            });
        },
    })
}
