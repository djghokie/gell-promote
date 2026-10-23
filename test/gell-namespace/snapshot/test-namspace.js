const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const namespace = require('../../../gell-namespace/snapshot/namespace');
const ecosystem = require('../../../gell-namespace/domain/ecosystem');
const tenant = require('../../../gell-namespace/domain/tenant');

describe('namespace lookup snapshot', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let tenant_;

    beforeEach(async function() {
        const { types, store } = this.deps.resolve('types', 'store');

        tenant_ = types.instance(tenant.TYPE);

        await store.save(tenant_);
    })

    describe('effect', function() {
        beforeEach(function() {
        })
    
        it('returns namespace', async function() {
            const existing$ = await namespace.effect({
                params: {
                    type: tenant.TYPE,
                    id: tenant_.id
                },
                deps: this.deps
            });

            assert(existing$);
        })
    })
})