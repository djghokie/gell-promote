const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../../bootstrap');

const browser = require('gell-web/domain/browser');

const application = require('../../../../gell-namespace/domain/application');
const createApplication = require('../../../../gell-namespace/action/create');
const user = require('../../../../gell-web/user/event/create-alt');

describe('create user (alt)', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store, app, caller;

    beforeEach(function() {
        this.createApplication = async function(id) {
            /**
             * WIP: fix namespace create action
            app = await createApplication.effect({
                parmas: {
                    type: application.TYPE
                },
                deps: this.deps
            });
             */

            const app = application.materialize({ id });

            await store.save(app);

            return app;
        }
    })

    beforeEach(async function() {
        store = this.deps.resolveSingle('store');

        app = await this.createApplication('ADMIN');

        caller = browser.materialize({
            parentId: app.id,
        });
        caller.set('namespaceId', 'UNITTEST:BLUEHOUR');
    })

    describe('action', function() {
        describe('application parameter', function() {
            beforeEach(function() {
                this.createUser = async function(email, role, applicationId) {
                    const $txn = store.write();

                    const user_ = await user.action({
                        caller,
                        params: {
                            email,
                            role,
                            applicationId
                        },
                        context: {
                            $txn
                        },
                        deps: this.deps
                    })

                    await $txn.return().value;

                    return user_;
                }
            })

            it('returns created user', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                assert(user_);
            })
        
            it('fails if application does not exist', function() {
                return assert.rejects(z => this.createUser('user@test.com', 'admin', 'WEB'));
            })

            it('saves user correctly', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                const [user$] = store.select({ id: user_.id });

                assert.strictEqual(user$.namespaceId, 'UNITTEST:BLUEHOUR');
            })
        })

        describe('caller', function() {
            beforeEach(function() {
                this.createUser = async function(email, role) {
                    return user.action({
                        params: {
                            email,
                            role
                        },
                        caller,
                        deps: this.deps
                    })
                }
            })

            it('returns created user', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'ADMIN::WEB#USER');
            })
        })

        // 
        /**
         * WIP: see note in action
         *  - this test doesn't really make any sense because caller should always have a parentId
         */
        describe('context', function() {
            let ops;

            beforeEach(function() {
                this.createUser = async function(email, role) {
                    return user.action({
                        params: {
                            email,
                            role
                        },
                        context: {
                            application: ops
                        },
                        caller,
                        deps: this.deps
                    })
                }
            })

            beforeEach(function() {
                ops = this.createApplication('OPS');

                caller.remove('parentId');
            })

            it('returns created user', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'OPS::WEB#USER');
            })
        })
    })
})