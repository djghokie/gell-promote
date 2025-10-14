const assert = require('assert');
const _ = require('lodash');

const init = require('gell/future/init');

const runtime = require('gell-runtime/mocha');

const resolver = require('gell-session/dispatch/resolver');

const MockStore = require('gell-aws-dynamodb/mock/store');

const transaction = require('../../../gell-aws-dynamodb/middleware/transaction');

function createEvent($resolver, deps) {
    const route = 'unittest.event#action';
    const [eventModule, { f: triggerF }, { resource: eventName, f: triggerName }] = $resolver.next(route).value;
    const { __metadata:md } = eventModule;
    const { triggers={} } = md;
    const trigger = triggers[triggerName];
    return {
        // caller,
        // source,
        context: {},
        params: {},
        deps,
        __invocationSpec: {
            route,
            eventName,
            triggerName,
            triggerSpec: trigger
        }
    };
}

describe('transaction middleware', function() {
    let testEvent, $resolver, store, event, resume, resumed, chainError;

    before(runtime.beforeAll);

    beforeEach(function() {
        store = new MockStore();
        this.deps.define('store', store);

        testEvent = {
            __metadata: {
                name: 'session.cancel',
                description: '"session.cancel" event',
                triggers: {
                    effect: {},
                    action: {}
                }
            },

            effect: async function() {},
            action: async function() {},
        }

        const events = {
            'unittest.event': testEvent
        };
        [$resolver] = init(resolver.object(events));

        resume = function() {
            resumed = true;

            if (chainError) throw new Error();
        }

        resumed = false;
    })

    describe('NEW mode', function() {
        beforeEach(function() {
            testEvent.__metadata.triggers.action.transaction = 'NEW';

            event = createEvent($resolver, this.deps);
        })
    
        it('resumes chain', async function() {
            await transaction(event, resume);

            assert(resumed);
        })

        it('fails if transaction exists', async function() {
            event.context.$txn = store.write();

            try {
                await transaction(event, resume);

                assert.fail('should have thrown exception');
            } catch (e) {
                assert.strictEqual(e.name, 'InvalidTransactionState');
            }

        })
    })

    describe('REQUIRED mode', function() {
        beforeEach(function() {
            testEvent.__metadata.triggers.action.transaction = 'REQUIRED';

            event = createEvent($resolver, this.deps);
        })
    
        it('resumes chain', async function() {
            event.context.$txn = store.write();

            await transaction(event, resume);

            assert(resumed);
        })

        it('fails if no transaction exists', async function() {
            try {
                await transaction(event, resume);

                assert.fail('should have thrown exception');
            } catch (e) {
                assert.strictEqual(e.name, 'InvalidTransactionState');
            }

        })
    })

    describe('JOIN mode', function() {
        beforeEach(function() {
            testEvent.__metadata.triggers.action.transaction = 'JOIN';

            event = createEvent($resolver, this.deps);
        })
    
        it('resumes chain', async function() {
            event.context.$txn = store.write();

            await transaction(event, resume);

            assert(resumed);
        })
    })
})