const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../../bootstrap');

const browser = require('gell-web/domain/browser');

const ecosystem = require('../../../../gell-namespace/domain/ecosystem');
const application = require('../../../../gell-namespace/domain/application');
const createApplication = require('../../../../gell-namespace/action/create');
const user = require('../../../../gell-web/user/event/create');

describe('create user', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store, app, caller;

    beforeEach(function() {
        this.createApplication = async function(id) {
            const app_ = await createApplication.effect({
                params: {
                    relativeId: id
                },
                context: {
                    type: application.TYPE,
                    parent_: ecosystem.materialize({ id: 'UNITTEST' })
                },
                deps: this.deps
            });

            await store.save(app_);

            return app_;
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
                const user_ = await this.createUser('user@test.com', 'admin', 'UNITTEST:ADMIN');

                assert(user_);
            })
        
            it('fails if application does not exist', function() {
                return assert.rejects(z => this.createUser('user@test.com', 'admin', 'UNITTEST:WEB'));
            })

            it('saves user namespaced by the application', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'UNITTEST:ADMIN');

                const [user$] = store.select({ id: user_.id });

                assert.strictEqual(user$.type, 'UNITTEST:ADMIN::WEB#USER');
                assert.strictEqual(user$.parentId, 'UNITTEST:ADMIN');
            })

            it('saves user without roles', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'UNITTEST:ADMIN');

                const [user$] = store.select({ id: user_.id });

                assert.strictEqual(user$.roles, undefined);
                assert.strictEqual(user$.namespaceId, undefined);
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
                console.debug('#####', caller);
                const user_ = await this.createUser('user@test.com', 'admin', 'UNITTEST:ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'UNITTEST:ADMIN::WEB#USER');
                assert.strictEqual(user$.parentId, 'UNITTEST:ADMIN');
            })

            it('without types', async function() {
                // NOTE: no way to "unset" a dependency
                delete this.deps._dependencies.types;

                const user_ = await this.createUser('user@test.com', 'admin', 'UNITTEST:ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'WEB#USER');
                assert.strictEqual(user$.parentId, 'UNITTEST:ADMIN');
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
                const user_ = await this.createUser('user@test.com', 'admin', 'UNITTEST:ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'UNITTEST:OPS::WEB#USER');
                assert.strictEqual(user$.parentId, 'UNITTEST:OPS');
            })
        })
    })
})