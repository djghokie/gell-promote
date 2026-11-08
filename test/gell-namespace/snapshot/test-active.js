const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const active = require('../../../gell-namespace/snapshot/active');
const ecosystem = require('../../../gell-namespace/domain/ecosystem');
const tenant = require('../../../gell-namespace/domain/tenant');

describe('active namespaces snapshot', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store;
    let parent_;

    beforeEach(function() {
        parent_ = ecosystem.materialize();
    })

    describe.skip('api', function() {
        beforeEach(function() {
        })
    
        it('no namespaces', async function() {
            await active.api({
                deps: this.deps
            });
            
            assert.fail('should fail');
        })
    })

    describe('effect', function() {
        beforeEach(function() {
        })
    
        it('no namespaces', async function() {
            await active.effect({
                params: {
                    type: tenant.TYPE,
                },
                deps: this.deps
            });
        })
    })
})