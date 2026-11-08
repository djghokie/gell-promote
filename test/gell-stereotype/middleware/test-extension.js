const assert = require('assert');

const middleware = require('../../../gell-stereotype/middleware/extension');

const THING_MODEL = { attributes: { name: { type: 'string' } } };

const THING = { name: 'thing', types: { 'UNITTEST#THING': { model: THING_MODEL } } };
const WIDGET = {
    name: 'WIDGET',
    extends: THING,
    types: { 'UNITTEST#THING': { name: 'UNITTEST#WIDGET' } },
    parentContext: 'parent_',
};

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
        assert.deepStrictEqual(resumed.context.extensionTypes, {});
        assert.strictEqual(resumed.context.other, 1);
        assert.strictEqual(resumed.__invocationSpec, event.__invocationSpec);
    })

    it('does not modify the caller context', function() {
        event = invocation({ extension: WIDGET, stereotype: THING });

        middleware(event, resume);

        assert.strictEqual(event.context.extension, undefined);
    })

    it('fails when a trigger with an extension spec is not dispatched for an extension', function() {
        event = invocation({ spec: { types: ['UNITTEST#THING'] } });

        assert.throws(() => middleware(event, resume), e => {
            assert.strictEqual(e.name, 'ExtensionRequiredError');
            assert.strictEqual(e.message,
                'call to event trigger (route="thing.create#action") must be dispatched for an extension (e.g. EXTENSION$thing.create)');

            return true;
        });
        assert(!resumed);
    })

    describe('types', function() {
        it('resolves the extension types in context', function() {
            event = invocation({ extension: WIDGET, stereotype: THING, spec: { types: ['UNITTEST#THING'] } });

            middleware(event, resume);

            const { name, model } = resumed.context.extensionTypes['UNITTEST#THING'];

            assert.strictEqual(name, 'UNITTEST#WIDGET');
            assert.deepStrictEqual(model.extends, [THING_MODEL]);
        })

        it('fails when the extension does not extend a required type', function() {
            const GADGET = { name: 'GADGET', extends: THING };

            event = invocation({ extension: GADGET, stereotype: THING, spec: { types: ['UNITTEST#THING'] } });

            assert.throws(() => middleware(event, resume), e => {
                assert.strictEqual(e.name, 'ExtensionTypeError');
                assert.strictEqual(e.extension, 'GADGET');
                assert.strictEqual(e.typeName, 'UNITTEST#THING');
                assert.strictEqual(e.message,
                    'extension (name="GADGET") does not extend type (name="UNITTEST#THING") for event trigger (route="GADGET$thing.create#action")');

                return true;
            });
            assert(!resumed);
        })

        it('fails when no stereotype declares a required type', function() {
            event = invocation({ extension: WIDGET, stereotype: THING, spec: { types: ['UNITTEST#OTHER'] } });

            assert.throws(() => middleware(event, resume), { name: 'ExtensionTypeError' });
        })
    })

    describe('attributes', function() {
        it('fails when the extension does not provide a required attribute', function() {
            event = invocation({ extension: WIDGET, stereotype: THING, spec: { attributes: { config: {} } } });

            assert.throws(() => middleware(event, resume), e => {
                assert.strictEqual(e.name, 'ExtensionAttributeError');
                assert.strictEqual(e.extension, 'WIDGET');
                assert.strictEqual(e.attribute, 'config');

                return true;
            });
            assert(!resumed);
        })

        it('fails when an extension attribute is not of the declared type', function() {
            event = invocation({
                extension: { ...WIDGET, parentContext: 7 },
                stereotype: THING,
                spec: { attributes: { parentContext: { type: 'string' } } },
            });

            assert.throws(() => middleware(event, resume), e => {
                assert.strictEqual(e.name, 'ExtensionAttributeError');
                assert.strictEqual(e.type, 'string');

                return true;
            });
        })

        it('accepts an extension that omits optional attributes', function() {
            event = invocation({
                extension: { ...WIDGET, parentContext: undefined },
                stereotype: THING,
                spec: { attributes: { parentContext: { type: 'string', optional: true } } },
            });

            middleware(event, resume);

            assert(resumed.context.extension);
        })
    })
})
