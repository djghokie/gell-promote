const assert = require('assert');
const _ = require('lodash');

const sessionCallback = require('../../../gell-auth/callback/session');
const browser = require('../../../gell-web/domain/browser');

describe('session callback', function() {
    let callback, session;

    // NOTE: NextAuth's default session (JWT strategy), built from the decoded token
    function defaultSession() {
        return {
            user: { name: 'Test User', email: 'user@test.com', image: 'https://example.test/u.png' },
            expires: '2026-12-07T00:00:00.000Z'
        };
    }

    beforeEach(function() {
        callback = sessionCallback();
        session = defaultSession();
    })

    describe('signed in, TENANT selected', function() {
        let token;

        beforeEach(function() {
            token = {
                sub: 'user-id',
                email: 'user@test.com',
                firstName: 'Test',
                lastName: 'User',
                role: 'administrator',
                tenantId: 'TEST:TENANT',
            };
        })

        it('builds the session from the token', function() {
            assert.deepStrictEqual(callback({ session, token }), {
                userId: 'user@test.com',
                tenantId: 'TEST:TENANT',
                role: 'administrator',
                user: {
                    name: 'Test User',
                    email: 'user@test.com',
                    image: 'https://example.test/u.png',
                    id: 'user-id',
                    firstName: 'Test',
                    lastName: 'User',
                    role: 'administrator',
                },
                expires: '2026-12-07T00:00:00.000Z',
            });
        })

        it('does not modify the default session', function() {
            callback({ session, token });

            assert.deepStrictEqual(session, defaultSession());
        })

        it('drops unexpected fields', function() {
            session.type = 'OTHER';
            token.status = 'ACTIVE';

            const session$ = callback({ session, token });

            assert.strictEqual(session$.type, undefined);
            assert.strictEqual(session$.status, undefined);
        })

        it('userId falls back to the default session email', function() {
            delete token.email;

            assert.strictEqual(callback({ session, token }).userId, 'user@test.com');
        })

        it('materializes as a BROWSER caller', function() {
            const browser_ = browser.materialize(callback({ session, token }));

            const browser$ = browser_.snapshotPartial(['type', 'userId', 'tenantId', 'role']);

            assert.deepStrictEqual(browser$, {
                type: 'WEB#BROWSER',
                userId: 'user@test.com',
                tenantId: 'TEST:TENANT',
                role: 'administrator',
            });
            assert.strictEqual(browser_.userId, 'user@test.com');
        })
    })

    describe('signed in, no TENANT selected', function() {
        let session$;

        beforeEach(function() {
            session$ = callback({ session, token: { sub: 'user-id', email: 'user@test.com' } });
        })

        it('has no tenantId or role', function() {
            assert(!('tenantId' in session$));
            assert(!('role' in session$));
            assert(!('role' in session$.user));
        })

        it('has no undefined values (page props must serialize)', function() {
            const hasUndefined = o => Object.values(o).some(v => v === undefined || (_.isPlainObject(v) && hasUndefined(v)));

            assert(!hasUndefined(session$));
            assert.doesNotThrow(() => JSON.parse(JSON.stringify(session$)));
        })

        it('keeps the userId', function() {
            assert.strictEqual(session$.userId, 'user@test.com');
        })
    })

    it('returns the session unchanged without a token', function() {
        assert.strictEqual(callback({ session }), session);
    })
})
