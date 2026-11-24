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
                assert.strictEqual(e.status, 400);
                assert.strictEqual(e.route, 'unittest.event');
                assert.deepStrictEqual(e.errors, [{ parameter: 'message', rule: 'type', message: 'message must be a string' }]);
                assert.strictEqual(e.message, 'message must be a string');
            }

            assert(!resumed);
        })

        it('fails if required argument is not provided', async function() {
            try {
                await middleware(event, resume);

                assert.fail('should have thrown exception');
            } catch (e) {
                assert.strictEqual(e.name, 'ParameterValidationError');
                assert.strictEqual(e.status, 400);
                assert.deepStrictEqual(e.errors, [{ parameter: 'message', rule: 'required', message: 'message is required' }]);
                assert.strictEqual(e.message, 'message is required');
            }

            assert(!resumed);
        })

        for (const blank of [null, '']) {
            it(`fails if required argument is ${JSON.stringify(blank)}`, async function() {
                event.params.message = blank;

                await assert.rejects(async () => middleware(event, resume), e => e.name === 'ParameterValidationError' && e.status === 400 && e.errors[0].parameter === 'message' && e.errors[0].rule === 'required');

                assert(!resumed);
            })
        }

        it('answers a type failure with status 400', async function() {
            event.params.message = 7;

            await assert.rejects(async () => middleware(event, resume), e => e.name === 'ParameterValidationError' && e.status === 400);
        })

        describe('optional', function() {
            beforeEach(function() {
                event.__invocationSpec.triggerSpec.params.message.optional = true;
            })

            it('does not fail if argument is not provided', async function() {
                await middleware(event, resume);

                assert(resumed);
            })

            it('does not fail if argument is blank', async function() {
                event.params.message = '';

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
                    assert.strictEqual(e.name, 'ParameterValidationError');
                    assert.strictEqual(e.errors[0].rule, 'maxLength');
                    assert.strictEqual(e.message, 'message must be at most 10 characters');
                }

                assert(!resumed);
            })
        })
    })

    describe('shorthand spec', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec.params.message = 'string';
        })

        it('fails if required argument is not provided', async function() {
            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: message is required/);
        })

        it('fails if argument is not a string', async function() {
            event.params.message = 7;

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError/);
        })
    })

    describe('several parameters', function() {
        beforeEach(function() {
            Object.assign(event.__invocationSpec.triggerSpec.params, { title: 'string', id: { type: 'string' } });
        })

        it('reports every failure in one error', async function() {
            event.params.id = 7;

            await assert.rejects(async () => middleware(event, resume), e => {
                assert.strictEqual(e.errors.length, 2);
                assert.strictEqual(e.message, 'title is required; id must be a string');

                return true;
            });

            assert(!resumed);
        })

        it('logs each failure', async function() {
            const lines = [];
            event.deps = { resolveSingle: () => ({ info: line => lines.push(line) }) };

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError/);

            assert.deepStrictEqual(lines, [
                'parameter validation failed (route="unittest.event"; parameter="title"; rule="required")',
                'parameter validation failed (route="unittest.event"; parameter="id"; rule="required")',
            ]);
        })
    })
})
