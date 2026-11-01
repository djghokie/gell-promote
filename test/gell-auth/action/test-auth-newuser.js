const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const auth = require('../../../gell-auth/action/auth-newuser');

describe('newuser auth action', function() {
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
    
                credentials = {
                    userId,
                    role: 'operator'
                };
    
                const user$ = await auth.effect({
                    params: credentials,
                    deps: this.deps
                });
    
                assert.strictEqual(user$.userId, userId);
            })
        })

        describe('namespaced user', function() {
            beforeEach(function() {
            })
        
            it('returns user if successful', async function() {
                const userId = 'user@test.com';
    
                credentials = {
                    userId,
                    role: 'admin'
                };
    
                // console.debug('#####', existing_);
    
                const user$ = await auth.effect({
                    params: credentials,
                    context: {
                        application
                    },
                    deps: this.deps
                });

                assert.strictEqual(user$.userId, userId);
                assert.strictEqual(user$.roles[0], 'admin');
            })
        })
    })
})