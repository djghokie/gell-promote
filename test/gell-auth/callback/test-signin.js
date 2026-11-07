const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const userCreate = require('../../../gell-web/user/event/create-alt');
const signin = require('../../../gell-auth/callback/signin');

describe('signIn callback', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let application, store, callback;

    beforeEach(function() {
        store = this.deps.resolveSingle('store');

        application = {
            id: 'ADMIN'
        }

        callback = signin(application, this.deps);
    })

    beforeEach(function() {
        this.createUser = async function(userId) {
            const user_ = await userCreate.effect({
                params: { email: userId },
                context: { application },
                deps: this.deps
            });

            await store.save(user_);

            return user_;
        }
    })

    describe('google', function() {
        const account = { provider: 'google' };

        it('allows an AUTHORIZED USER', async function() {
            await this.createUser('user@test.com');

            assert.strictEqual(await callback({ user: { email: 'user@test.com' }, account }), true);
        })

        it('refuses an unknown email', async function() {
            assert.strictEqual(await callback({ user: { email: 'nobody@test.com' }, account }), false);
        })

        it('refuses a USER that is not AUTHORIZED', async function() {
            const user_ = await this.createUser('user@test.com');
            user_.set('status', 'SUSPENDED');
            await store.save(user_);

            assert.strictEqual(await callback({ user: { email: 'user@test.com' }, account }), false);
        })
    })

    it('allows credentials providers (decided in authorize)', async function() {
        assert.strictEqual(await callback({ user: { email: 'nobody@test.com' }, account: { provider: 'passwordless' } }), true);
    })
})
