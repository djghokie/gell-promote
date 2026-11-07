const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const user = require('gell-web/domain/user');

const tenant = require('../../../gell-namespace/domain/tenant');
const userCreate = require('../../../gell-web/user/event/create-alt');
const memberCreate = require('../../../gell-web/member/event/create');
const jwt = require('../../../gell-auth/callback/jwt');

describe('jwt callback', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let application, store, bluehour, callback, token;

    beforeEach(function() {
        this.createUser = async function(userId) {
            const user_ = await userCreate.effect({
                params: {
                    email: userId
                },
                context: {
                    application
                },
                deps: this.deps
            });

            await store.save(user_);

            return user_;
        }

        this.createMember = async function(userId, role, tenant_=bluehour) {
            const $txn = store.write();

            const member_ = await memberCreate.effect({
                params: { userId, role },
                context: { parent_: tenant_, namespaceId: application.id, $txn },
                deps: this.deps
            });

            await $txn.return().value;

            return member_;
        }
    })

    beforeEach(async function() {
        /**
         * NOTE: re-registering the user type here to match what an application would typically do
         *  - this affects the user lookup effect
         */
        const { types } = this.deps.resolve('types');
        types.register(user.TYPE, user.model, 'APPLICATION');

        store = this.deps.resolveSingle('store');

        application = {
            id: 'ADMIN'
        }

        bluehour = tenant.materialize({ id: 'UNITTEST:BLUEHOUR', name: 'Blue Hour' });
        await store.save(bluehour);

        callback = jwt(application, this.deps);

        token = {};
    })

    describe('google', function() {
        let account;

        beforeEach(function() {
            account = {
                provider: 'google'
            };
        })

        it('does not fail if user does not exist', async function() {
            const user = {
                email: 'viwewer@#test.com'
            };
            
            await callback({ token, user, account });

            const { role } = token;

            assert(_.isUndefined(role));
        })
    
        it('populates identity from the USER', async function() {
            const userId = 'viewer@test.com';

            const user_ = await this.createUser(userId);

            await callback({ token, user: { email: userId }, account });

            assert.strictEqual(token.sub, user_.get('id'));
            assert.strictEqual(token.userId, userId);
            assert.strictEqual(token.applicationId, 'ADMIN');
        })

        it('does not select a tenant or role on sign in', async function() {
            const userId = 'viewer@test.com';

            await this.createUser(userId);
            await this.createMember(userId, 'viewer');

            await callback({ token, user: { email: userId }, account });

            assert.strictEqual(token.tenantId, undefined);
            assert.strictEqual(token.role, undefined);
        })
    })

    describe('credentials', function() {
        it('populates identity from the authorized USER', async function() {
            const user$ = { id: '123', userId: 'user@test.com', email: 'user@test.com', parentId: 'ADMIN' };

            await callback({ token, user: user$, account: { provider: 'passwordless' } });

            assert.strictEqual(token.sub, '123');
            assert.strictEqual(token.userId, 'user@test.com');
            assert.strictEqual(token.applicationId, 'ADMIN');
            assert.strictEqual(token.role, undefined);
        })
    })

    describe('update (tenant selection)', function() {
        beforeEach(async function() {
            await this.createMember('viewer@test.com', 'viewer');

            token = { sub: '123', userId: 'viewer@test.com', applicationId: 'ADMIN' };
        })

        it('sets tenant and MEMBER role', async function() {
            await callback({ token, trigger: 'update', session: { tenantId: 'UNITTEST:BLUEHOUR' } });

            assert.strictEqual(token.tenantId, 'UNITTEST:BLUEHOUR');
            assert.strictEqual(token.role, 'viewer');
        })

        it('clears tenant and role for a tenant the USER is not a MEMBER of', async function() {
            await callback({ token, trigger: 'update', session: { tenantId: 'UNITTEST:BLUEHOUR' } });
            await callback({ token, trigger: 'update', session: { tenantId: 'UNITTEST:OTHER' } });

            assert.strictEqual(token.tenantId, undefined);
            assert.strictEqual(token.role, undefined);
        })

        it('ignores a role passed to update', async function() {
            await callback({ token, trigger: 'update', session: { tenantId: 'UNITTEST:BLUEHOUR', role: 'administrator' } });

            assert.strictEqual(token.role, 'viewer');
        })

        it('leaves tenant alone for an update without tenantId', async function() {
            await callback({ token, trigger: 'update', session: { tenantId: 'UNITTEST:BLUEHOUR' } });
            await callback({ token, trigger: 'update', session: { other: 'value' } });

            assert.strictEqual(token.tenantId, 'UNITTEST:BLUEHOUR');
            assert.strictEqual(token.role, 'viewer');
        })
    })
})
