const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const user = require('gell-web/domain/user');

// const createUser = require('../../../gell-web/user/action/create');
const auth = require('../../../gell-auth/action/auth-passwordless');

describe('passwordless auth action', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store;
    let application;

    beforeEach(function() {
        store = this.deps.resolveSingle('store');

        application = {
            id: 'UNITTEST:WEB'
        }
    })

    beforeEach(function() {
        /**
         * WIP: this should use create action
         *  - create probably needs to be re-implemented
         *      - support namespaces
         */
        this.createUser = async function(userId, application={}) {
            assert(userId);

            const { id } = application;

            if (id)
                var type = `${id}::${user.TYPE}`;

            const user_ = user.materialize({
                type,

                userId,
                email: userId
            })

            await store.save(user_);

            return user_;
        }
    })

    describe('effect', function() {
        let credentials;

        beforeEach(function() {
            credentials = {
                userId: '123',
                email: 'user@#test.com'
            };
        })

        describe('non-namespaced user', function() {
            beforeEach(function() {
            })
        
            it('returns user if successful', async function() {
                const userId = 'user@test.com';
    
                const existing_ = await this.createUser(userId);
    
                credentials = {
                    userId
                };
    
                // console.debug('#####', existing_);
    
                const user$ = await auth.effect({
                    params: credentials,
                    deps: this.deps
                });
    
                assert.strictEqual(user$.id, existing_.id);
            })
        })

        describe('namespaced user', function() {
            beforeEach(function() {
            })
        
            it('returns user if successful', async function() {
                const userId = 'user@test.com';
    
                const existing_ = await this.createUser(userId, application);
    
                credentials = {
                    userId
                };
    
                // console.debug('#####', existing_);
    
                const user$ = await auth.effect({
                    params: credentials,
                    context: {
                        application
                    },
                    deps: this.deps
                });

                assert.strictEqual(user$.id, existing_.id);
            })
        })
    })
})