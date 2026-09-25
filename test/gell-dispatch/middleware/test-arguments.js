const assert = require('assert');
const _ = require('lodash');

const middleware = require('../../../gell-dispatch/middleware/arguments');

describe('arguments middleware', function() {
    let event, resume, resumed;

    beforeEach(function() {
        event = {
            __invocationSpec: {
                route: 'unittest.event',
                triggerSpec: {
                    params: {}
                }
            },
            params: {}
        };

        resume = function() {
            resumed = true;
        }

        resumed = false;
    })

    describe('no parameters', function() {
        beforeEach(function() {
        })
    
        it('does not fail', async function() {
            await middleware(event, resume);

            assert(resumed);
        })
    })

    describe('string parameter', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec.params.message = {
                type: 'string'
            }
        })

        it('fails if argument is not a string', async function() {
            event.params.message = 7;

            try {
                await middleware(event, resume);

                assert.fail('should have thrown exception');
            } catch (e) {
                assert.strictEqual(e.name, 'ParameterValidationError');
                assert.strictEqual(e.parameter, 'message');
                assert.strictEqual(e.message, 'call to event trigger (route="unittest.event") has argument (name="message") that is not of type (type="string")');
            }

            assert(!resumed);
        })

        it('fails if required argument is not provided', async function() {
            try {
                await middleware(event, resume);

                assert.fail('should have thrown exception');
            } catch (e) {
                assert.strictEqual(e.name, 'RequiredParameterError');
            }

            assert(!resumed);
        })

        describe('optional', function() {
            beforeEach(function() {
                event.__invocationSpec.triggerSpec.params.message.optional = true;
            })

            it('does not fail if argument is not provided', async function() {
                await middleware(event, resume);

                assert(resumed);
            })

            it('does not fail if argument is provided', async function() {
                event.params.message = 'gello';

                await middleware(event, resume);

                assert(resumed);
            })

            it('fails if argument is not a string', async function() {
                event.params.message = 7;

                try {
                    await middleware(event, resume);

                    assert.fail('should have thrown exception');
                } catch (e) {
                    assert.strictEqual(e.name, 'ParameterValidationError');
                }

                assert(!resumed);
            })
        })

        describe('max length', function() {
            beforeEach(function() {
                event.__invocationSpec.triggerSpec.params.message.maxLength = 10;
                event.params.message = 'gello world!';
            })

            it('fails if argument is too long', async function() {
                try {
                    await middleware(event, resume);

                    assert.fail('should have thrown exception');
                } catch (e) {
                    // console.debug('#####', e);
                    assert.strictEqual(e.name, 'ParameterValidationError');
                }

                assert(!resumed);
            })
        })
    })
})