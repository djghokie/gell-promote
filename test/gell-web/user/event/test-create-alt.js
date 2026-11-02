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

    let store;
    let parent_;

    beforeEach(function() {
        store = this.deps.resolveSingle('store');
    })

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

    describe('action', function() {
        let app;

        beforeEach(async function() {
            app = await this.createApplication('ADMIN');
        })

        describe('application parameter', function() {
            beforeEach(function() {
                this.createUser = async function(email, role, applicationId) {
                    return user.action({
                        params: {
                            email,
                            role,
                            applicationId
                        },
                        deps: this.deps
                    })
                }
            })

            it('returns created user', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                assert(user_);
            })
        
            it('fails if application does not exist', function() {
                return assert.rejects(z => this.createUser('user@test.com', 'admin', 'WEB'));
            })
        })

        describe('caller', function() {
            let caller;

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

            beforeEach(function() {
                caller = browser.materialize({
                    parentId: app.id
                });
            })

            it('returns created user', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'ADMIN::WEB#USER');
            })
        })

        // WIP: see note in action
        describe('context', function() {
            let caller, ops;

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
                caller = browser.materialize();

                ops = this.createApplication('OPS');
            })

            it('returns created user', async function() {
                const user_ = await this.createUser('user@test.com', 'admin', 'ADMIN');

                const user$ = user_.snapshot();

                assert.strictEqual(user$.type, 'OPS::WEB#USER');
            })
        })
    })
})