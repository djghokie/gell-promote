const assert = require('assert');

const middleware = require('../../../gell-stereotype/middleware/extension');

const THING = { name: 'thing' };
const WIDGET = { name: 'WIDGET', TYPE: 'UNITTEST#WIDGET', extends: THING };

describe('gell-stereotype/middleware/extension', function() {
    let event, resumed;

    const resume = e => {
        resumed = e;

        return 'result';
    }

    function invocation({ extension, stereotype, spec }={}) {
        const eventName = extension ? `${extension.name}$thing.create` : 'thing.create';

        return {
            context: { other: 1 },
            __invocationSpec: {
                route: `${eventName}#action`,
                eventName,
                triggerName: 'action',
                triggerSpec: spec ? { extension: spec } : {},
                metadata: { name: eventName, extension, stereotype },
            },
        };
    }

    beforeEach(function() {
        resumed = undefined;
    })

    it('resumes regular events unchanged', function() {
        event = invocation();

        assert.strictEqual(middleware(event, resume), 'result');
        assert.strictEqual(resumed, event);
    })

    it('resumes events without an invocation spec', function() {
        event = { context: {} };

        middleware(event, resume);

        assert.strictEqual(resumed, event);
    })

    it('puts the extension and stereotype in context', function() {
        event = invocation({ extension: WIDGET, stereotype: THING });

        middleware(event, resume);

        assert.strictEqual(resumed.context.extension, WIDGET);
        assert.strictEqual(resumed.context.stereotype, THING);
        assert.strictEqual(resumed.context.other, 1);
        assert.strictEqual(resumed.__invocationSpec, event.__invocationSpec);
    })

    it('does not modify the caller context', function() {
        event = invocation({ extension: WIDGET, stereotype: THING });

        middleware(event, resume);

        assert.strictEqual(event.context.extension, undefined);
    })

    it('fails when a trigger with an extension spec is not dispatched for an extension', function() {
        event = invocation({ spec: { TYPE: { type: 'string' } } });

        assert.throws(() => middleware(event, resume), e => {
            assert.strictEqual(e.name, 'ExtensionRequiredError');
            assert.strictEqual(e.message,
                'call to event trigger (route="thing.create#action") must be dispatched for an extension (e.g. EXTENSION$thing.create)');

            return true;
        });
        assert(!resumed);
    })

    it('fails when the extension does not provide a required attribute', function() {
        event = invocation({ extension: { name: 'GADGET' }, stereotype: THING, spec: { TYPE: {} } });

        assert.throws(() => middleware(event, resume), e => {
            assert.strictEqual(e.name, 'ExtensionAttributeError');
            assert.strictEqual(e.extension, 'GADGET');
            assert.strictEqual(e.attribute, 'TYPE');

            return true;
        });
        assert(!resumed);
    })

    it('fails when an extension attribute is not of the declared type', function() {
        event = invocation({ extension: { ...WIDGET, TYPE: 7 }, stereotype: THING, spec: { TYPE: { type: 'string' } } });

        assert.throws(() => middleware(event, resume), e => {
            assert.strictEqual(e.name, 'ExtensionAttributeError');
            assert.strictEqual(e.type, 'string');

            return true;
        });
    })

    it('accepts an extension that omits optional attributes', function() {
        event = invocation({
            extension: WIDGET,
            stereotype: THING,
            spec: { TYPE: { type: 'string' }, parentContext: { type: 'string', optional: true } },
        });

        middleware(event, resume);

        assert.strictEqual(resumed.context.extension, WIDGET);
    })
})
