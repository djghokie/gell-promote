const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const bootstrap = require('../bootstrap');

const create = require('../../../gell-namespace/action/create');
const ecosystem = require('../../../gell-namespace/domain/ecosystem');
const application = require('../../../gell-namespace/domain/application');

describe('namespace create action', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store;
    let parent_;

    beforeEach(function() {
        store = this.deps.resolveSingle('store');
    })

    beforeEach(function() {
        parent_ = ecosystem.materialize();
    })

    describe('effect', function() {
        beforeEach(function() {
        })
    
        it('saves namespace', async function() {
            const $txn = store.write();

            await create.effect({
                context: {
                    type: application.TYPE,
                    parent_,
                    $txn
                },
                deps: this.deps
            });

            await $txn.return().value;

            // console.debug('#####', store.snapshot());

            const [application$] = store.select({ type: application.TYPE });

            assert.strictEqual(application$.type, 'NAMESPACE#APPLICATION');
        })
    })

})
