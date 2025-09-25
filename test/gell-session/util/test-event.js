const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');
const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const MockStore = require('gell-aws-dynamodb/mock/store');
const operationWrapper = require('gell-aws-dynamodb/operation-wrapper');
const sessionOperations = operationWrapper.ut(require('gell-session/dynamodb/operations'));

const { createUpdate } = require('../../../gell-session/util/event');

const TYPE = "TEST";

const model = {
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        title: {
            type: 'string',
            editable: true
        }
    }
}

const type = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}

describe('event generation utility', function() {
    let store;

    before(runtime.beforeAll);

    beforeEach(function() {
        store = new MockStore();
	    store.writeOptions.namedOperations = sessionOperations;  // NOTE: named operation not working for some reaons

        this.deps.define('store', store);
    })

    describe('update', function() {
        let update, session_;

        beforeEach(async function() {
            session_ = type.materialize({
                id: '123',
                title: 'gello'
            });

            await store.save(session_);

            update = createUpdate({}, type);
        })

        describe('action', function() {
            beforeEach(function() {
                this.update = async function(attribute, value) {
                    const $txn = store.write();

                    const updated_ = update.action({
                        params: {
                            id: session_.id,
                            attribute,
                            value
                        },
                        context: { $txn }, 
                        deps: this.deps
                    });

                    await $txn.return().value;

                    return updated_;
                }
            })

            it('simple editable attribute', async function() {
                const updated_ = await this.update('title', 'world!');

                // const [session$] = store.select({ type: type.TYPE });
                const session$ = updated_.snapshot();

                assert.strictEqual(session$.title, 'world!');
            })

            it('simple uneditable attribute', function() {
                return assert.rejects(z => this.update('type', '123'));
            })

            it('undefined attribute', function() {
                return assert.rejects(z => this.update('message', 'gello!'));
            })

            it('inherited attribute');
        })

        describe('effect', function() {
            beforeEach(function() {
                this.update = async function(attribute, value) {
                    const $txn = store.write();

                    const updated_ = update.effect({
                        params: {
                            attribute,
                            value
                        },
                        context: {
                            session_,
                            $txn
                        }, 
                        deps: this.deps
                    });

                    await $txn.return().value;

                    return updated_;
                }
            })

            it('simple editable attribute', async function() {
                const updated_ = await this.update('title', 'world!');

                const [session$] = store.select({ type: type.TYPE });

                assert.strictEqual(session$.title, 'world!');
            })
        })
    })
})
