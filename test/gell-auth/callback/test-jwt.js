const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const user = require('gell-web/domain/user');

const userCreate = require('../../../gell-web/user/event/create-alt');
const jwt = require('../../../gell-auth/callback/jwt');

describe('jwt callback', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let application, store;

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
    })

    beforeEach(function() {
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
    })

    describe('google', function() {
        let google, token, account;

        beforeEach(function() {
            google = jwt(application, this.deps);

            account = {
                provider: 'google'
            };

            token = {};
        })

        it('does not fail if user does not exist', async function() {
            const user = {
                email: 'viwewer@#test.com'
            };
            
            await google({ token, user, account });

            const { role } = token;

            assert(_.isUndefined(role));
        })
    
        // WIP: role comes from the selected TENANT's MEMBER (user-auth increment 4)
        it.skip('populates token correctly', async function() {
            const userId = 'viwewer@#test.com';

            await this.createUser(userId);

            const user = {
                email: userId
            };

            await google({ token, user, account });

            const { role } = token;

            assert.strictEqual(role, 'viewer');
        })
    })
})
