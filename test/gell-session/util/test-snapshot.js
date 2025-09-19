const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');
const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');
const MockStore = require('gell-aws-dynamodb/mock/store');

const { createLookup } = require('../../../gell-session/util/snapshot');

const TYPE = "TEST";

const model = {
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
    }
}

const type = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}

describe('snapshot generation utility', function() {
    let store;

    before(runtime.beforeAll);

    beforeEach(function() {
        store = new MockStore();

        this.deps.define('store', store);
    })

    describe('lookup', function() {
        let lookup;

        beforeEach(async function() {
            await store.save(type.materialize({ id: '123' }));

            lookup = createLookup({}, type);
        })

        describe('effect', function() {
            beforeEach(function() {
            })
        
            it('existing session', async function() {
                const type_ = await lookup.effect({
                    params: {
                        id: '123'
                    },
                    deps: this.deps
                });

                const type$ = type_.snapshot();
                assert.strictEqual(type$.id, '123');
            })

            describe('with projection', function() {
                beforeEach(function() {
                })
            
                it('attibute array', async function() {
                    const type_ = await lookup.effect({
                        params: {
                            id: '123'
                        },
                        context: {
                            projection: ['id', 'initiatedTs']
                        },
                        deps: this.deps
                    });

                    const type$ = type_.snapshot();
                    assert.strictEqual(type$.id, '123');
                    assert(type$.initiatedTs);
                    assert(_.isUndefined(type$.type));
                })
            })
        })
    })
})
