const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');
const MockStore = require('gell-aws-dynamodb/mock/store');
const queryWrapper = require('gell-aws-dynamodb/query-wrapper');

const active = require('../../../gell-namespace/snapshot/active');
const ecosystem = require('../../../gell-namespace/domain/ecosystem');
const tenant = require('../../../gell-namespace/domain/tenant');

const sessionQueries = require('gell-session/dynamodb/queries');
const activeQueries = require('gell-session/dynamodb/active/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');

describe('active namespaces snapshot', function() {
    before(runtime.beforeAll);

    let store;
    let parent_;

    beforeEach(function() {
        store = new MockStore();
        Object.assign(store.namedQueries,
            queryWrapper.ut(sessionQueries),
            queryWrapper.ut(activityQueries),
        );
    
        this.deps.define('store', store);

        this.deps.define('types', {});
    })

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