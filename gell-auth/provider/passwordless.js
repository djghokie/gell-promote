import assert from 'node:assert';

import CredentialsProvider from 'next-auth/providers/credentials';

import auth from '../action/auth-passwordless';

/**
 * Create a new instance of the "passwordless" credentials provider
 * 
 * NOTES
 *  - used in non-production scenarios to sign in as an existing user
 *  - could potentially pass in id and/or name as arguments
 */
export default function passwordlessProvider(application, deps) {
    assert(deps, 'deps is required');

    return CredentialsProvider({
        id: 'passwordless',

        name: 'Passwordless Credentials Provider',

        credentials: {
            email: {
                label: 'Email',
                type: 'email',
                placeholder: 'your@email.com'
            },
            role: {
                label: 'Role (creates the user)',
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
