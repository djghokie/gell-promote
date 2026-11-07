const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const tenant = require('../../../gell-namespace/domain/tenant');

const auth = require('../../../gell-auth/action/auth-newuser');

describe('newuser auth action', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store;
    let application;

    beforeEach(async function() {
        store = this.deps.resolveSingle('store');

        application = {
            id: 'UNITTEST:WEB'
        }

        await store.save(tenant.materialize({ id: 'UNITTEST:BLUEHOUR', name: 'Blue Hour' }));
    })

    beforeEach(function() {
        this.authenticate = async function(credentials) {
            return auth.effect({
                params: credentials,
                context: {
                    application
                },
                deps: this.deps
            });
        }
    })

    describe('effect', function() {
        it('returns user if successful', async function() {
            const user$ = await this.authenticate({ userId: 'user@test.com', role: 'admin', tenantId: 'UNITTEST:BLUEHOUR' });

            assert.strictEqual(user$.userId, 'user@test.com');
            // NOTE: USERs don't hold roles; the role belongs to a MEMBER
            assert.strictEqual(user$.roles, undefined);
        })

        it('saves user scoped to the application', async function() {
            const user$ = await this.authenticate({ userId: 'user@test.com', role: 'admin', tenantId: 'UNITTEST:BLUEHOUR' });

            const [saved$] = store.select({ id: user$.id });

            assert.strictEqual(saved$.type, 'UNITTEST:WEB::WEB#USER');
            assert.strictEqual(saved$.parentId, 'UNITTEST:WEB');
        })

        it('saves MEMBER of the tenant with the role', async function() {
            await this.authenticate({ userId: 'user@test.com', role: 'admin', tenantId: 'UNITTEST:BLUEHOUR' });

            const [member$] = store.select({ type: 'UNITTEST:WEB::WEB#MEMBER' });

            assert.strictEqual(member$.userId, 'user@test.com');
            assert.strictEqual(member$.parentId, 'UNITTEST:BLUEHOUR');
            assert.strictEqual(member$.role, 'admin');
        })

        it('returns nothing (and saves nothing) if the tenant does not exist', async function() {
            const user$ = await this.authenticate({ userId: 'user@test.com', role: 'admin', tenantId: 'UNITTEST:MISSING' });

            assert.strictEqual(user$, undefined);
            assert.strictEqual(store.select({ userId: 'user@test.com' }).length, 0);
        })

        it('returns nothing without a tenant', async function() {
            const user$ = await this.authenticate({ userId: 'user@test.com', role: 'admin' });

            assert.strictEqual(user$, undefined);
        })
    })
})
