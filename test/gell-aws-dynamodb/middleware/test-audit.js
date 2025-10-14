const assert = require('assert');
const _ = require('lodash');

const init = require('gell/future/init');

const runtime = require('gell-runtime/mocha');

const resolver = require('gell-session/dispatch/resolver');

const eventType = require('../../../gell-session/domain/event');

const MockStore = require('gell-aws-dynamodb/mock/store');

const audit = require('../../../gell-aws-dynamodb/middleware/audit');

const testEvent = {
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

// WIP: probably put this in gell-aws-dyanmodb
describe('event audit middleware', function() {
    let store, event, resume, resumed, chainError;

    before(runtime.beforeAll);

    beforeEach(function() {
        store = new MockStore();
        this.deps.define('store', store);

        const events = {
            'unittest.event': testEvent
        };
        const [$resolver] = init(resolver.object(events));

        const route = 'unittest.event#action';
        const [eventModule, { f: triggerF }, { resource: eventName, f: triggerName }] = $resolver.next(route).value;

        event = {
            // caller,
            // source,
            // context,
            params: {},
            deps: this.deps
        };

        const { __metadata:md } = eventModule;
        if (md) {
            const { triggers={} } = md;
            const trigger = triggers[triggerName];
            if (trigger) {
                event.__invocationSpec = {
                    route,
                    eventName,
                    triggerName,
                    triggerSpec: trigger
                };
            }
        }

        resume = function() {
            resumed = true;

            if (chainError) throw new Error();

            return 'foobar';
        }

        resumed = false;
    })

    it('saves event', async function() {
        await audit(event, resume);

        const [event$] = store.select({ type: eventType.TYPE });

        assert.strictEqual(event$.name, 'unittest.event');
        assert.strictEqual(event$.status, 'SUCCESS');
    })

    it('returns result of resume', async function() {
        const result = await audit(event, resume);

        assert.strictEqual(result, 'foobar');
    })

    it('resumes chain', async function() {
        await audit(event, resume);

        assert(resumed);
    })

    it('handles errors', async function() {
        chainError = true;

        try {
            await audit(event, resume);
        } catch (e) {}

        const [event$] = store.select({ type: eventType.TYPE });

        assert.strictEqual(event$.status, 'FAILED');
    })
})
