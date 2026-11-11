const assert = require('assert');
const _ = require('lodash');

const { lift } = require('gell/future');
const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const browser = require('../../../gell-web/domain/browser');

const authorizer = require('../../../gell-auth/middleware/authorizer');

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
})
