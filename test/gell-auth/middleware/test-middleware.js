const assert = require('assert');
const _ = require('lodash');

const { lift } = require('gell/future');
const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const browser = require('../../../gell-web/domain/browser');
const member = require('../../../gell-web/member/domain/member');

const authorizer = require('../../../gell-auth/middleware/authorizer');
const namespaceLoader = require('../../../gell-auth/middleware/namespace');

describe('api middleware', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    describe('authorizer', function() {
        let authorize;

        beforeEach(function() {
            [authorize] = lift(authorizer());
        })

        it('rejects a request without a session (401)', async function() {
            await assert.rejects(authorize({}), e => e.status === 401);
        })

        it('rejects a session without a TENANT (403)', async function() {
            const session = browser.materialize({ userId: 'user@test.com', role: 'administrator' });

            await assert.rejects(authorize({ session }), e => e.status === 403);
        })

        it('rejects a session without a role (403)', async function() {
            const session = browser.materialize({ userId: 'user@test.com', tenantId: 'TEST:TENANT' });

            await assert.rejects(authorize({ session }), e => e.status === 403);
        })

        it('allows a session with a TENANT and role', async function() {
            const session = browser.materialize({ userId: 'user@test.com', tenantId: 'TEST:TENANT', role: 'administrator' });

            await authorize({ session });
        })
    })

    describe('namespace loader', function() {
        let load, context;

        beforeEach(function() {
            [load] = lift(namespaceLoader({ id: 'TEST:APP' }, 'TEST'));

            context = {
                deps: this.deps,
                session: browser.materialize({ userId: 'user@test.com', tenantId: 'TEST:TENANT', role: 'administrator' })
            }
        })

        it('requires a session TENANT', async function() {
            context.session.set('tenantId', undefined);

            await assert.rejects(load(context), /session tenantId is required/);
        })

        it('namespaces APPLICATION types by the APPLICATION', async function() {
            await load(context);

            const types = context.deps.resolveSingle('types');

            assert.strictEqual(types.name(member.TYPE), `TEST:APP::${member.TYPE}`);
        })

        it('namespaces TENANT types by the session TENANT', async function() {
            await load(context);

            const types = context.deps.resolveSingle('types');

            assert.strictEqual(types.snapshotAttribute('TENANT'), 'TEST:TENANT');
            assert.strictEqual(types.snapshotAttribute('ECOSYSTEM'), 'TEST');
        })

        it('leaves the registered types unchanged', async function() {
            await load(context);

            assert.strictEqual(this.deps.resolveSingle('types').snapshotAttribute('TENANT'), undefined);
        })
    })
})
