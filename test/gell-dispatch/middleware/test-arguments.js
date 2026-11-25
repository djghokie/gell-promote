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
                event.__invocationSpec.triggerSpec.params.message.validate = { maxLength: 10 };
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

    describe('enum', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec.params.color = { type: 'string', optional: true, validate: { enum: ['red', 'blue'] } };
        })

        it('accepts a listed value', async function() {
            event.params.color = 'red';

            await middleware(event, resume);

            assert(resumed);
        })

        it('does not check an omitted optional argument', async function() {
            await middleware(event, resume);

            assert(resumed);
        })

        it('fails for a value that is not listed', async function() {
            event.params.color = 'plaid';

            await assert.rejects(async () => middleware(event, resume), e => {
                assert.deepStrictEqual(e.errors, [{ parameter: 'color', rule: 'enum', message: 'color must be one of red, blue' }]);
                assert.strictEqual(e.status, 400);

                return true;
            });

            assert(!resumed);
        })
    })

    describe('string rules', function() {
        function spec(validate, others={}) {
            event.__invocationSpec.triggerSpec.params.title = { type: 'string', ...others, validate };
        }

        async function rejects(title, expected) {
            event.params.title = title;

            await assert.rejects(async () => middleware(event, resume), e => {
                assert.deepStrictEqual(e.errors, [{ parameter: 'title', ...expected }]);

                return true;
            });

            assert(!resumed);
        }

        async function accepts(title) {
            event.params.title = title;

            await middleware(event, resume);

            assert(resumed);
        }

        it('minLength 1 says the argument cannot be empty', async function() {
            spec({ minLength: 1 }, { optional: true });

            await rejects('', { rule: 'minLength', message: 'title cannot be empty' });
        })

        it('minLength', async function() {
            spec({ minLength: 3 });

            await rejects('ab', { rule: 'minLength', message: 'title must be at least 3 characters' });
            await accepts('abc');
        })

        it('maxLength', async function() {
            spec({ maxLength: 2 });

            await rejects('abc', { rule: 'maxLength', message: 'title must be at most 2 characters' });
            await accepts('ab');
        })

        it('pattern (string)', async function() {
            spec({ pattern: '^[A-Z]' });

            await rejects('abc', { rule: 'pattern', message: 'title must match ^[A-Z]' });
            await accepts('Abc');
        })

        it('pattern (RegExp)', async function() {
            spec({ pattern: /^\d+$/ });

            await rejects('12a', { rule: 'pattern', message: 'title must match /^\\d+$/' });
            await accepts('123');
        })

        it('reports only the first failing rule of an argument', async function() {
            spec({ minLength: 3, pattern: '^[A-Z]' });

            await rejects('a', { rule: 'minLength', message: 'title must be at least 3 characters' });
        })

        it('messages overrides a rule\'s default message', async function() {
            spec({ pattern: '^\\S', messages: { pattern: 'title cannot start with a space' } });

            await rejects(' abc', { rule: 'pattern', message: 'title cannot start with a space' });
        })

        it('does not apply string rules to an omitted optional argument', async function() {
            spec({ minLength: 3, pattern: '^[A-Z]' }, { optional: true });

            await accepts(undefined);
        })
    })

    describe('validate function', function() {
        let calls;

        beforeEach(function() {
            calls = [];

            Object.assign(event.__invocationSpec.triggerSpec.params, {
                startTs: 'number',
                endTs: {
                    type: 'number',
                    validate: (endTs, params) => {
                        calls.push([endTs, params]);

                        return params.startTs < endTs || 'startTs must be before endTs';
                    },
                },
            });
        })

        it('passes the value and a map of the other arguments', async function() {
            event.params = { startTs: 1, endTs: 2 };

            await middleware(event, resume);

            assert.deepStrictEqual(calls, [[2, { startTs: 1 }]]);
            assert(resumed);
        })

        it('fails with the message the function returns', async function() {
            event.params = { startTs: 2, endTs: 1 };

            await assert.rejects(async () => middleware(event, resume), e => {
                assert.strictEqual(e.status, 400);
                assert.deepStrictEqual(e.errors, [{ parameter: 'endTs', rule: 'validate', message: 'startTs must be before endTs' }]);

                return true;
            });

            assert(!resumed);
        })

        it('fails with a generic message when the function returns false', async function() {
            event.__invocationSpec.triggerSpec.params.endTs.validate = () => false;
            event.params = { startTs: 1, endTs: 2 };

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: endTs is not valid/);
        })

        it('passes when the function returns undefined', async function() {
            event.__invocationSpec.triggerSpec.params.endTs.validate = () => undefined;
            event.params = { startTs: 1, endTs: 2 };

            await middleware(event, resume);

            assert(resumed);
        })

        it('is not called for a missing required argument', async function() {
            event.params = { startTs: 1 };

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: endTs is required/);

            assert.deepStrictEqual(calls, []);
        })

        it('is not called for an omitted optional argument', async function() {
            event.__invocationSpec.triggerSpec.params.endTs.optional = true;
            event.params = { startTs: 1 };

            await middleware(event, resume);

            assert.deepStrictEqual(calls, []);
            assert(resumed);
        })

        it('is not called when the type check fails', async function() {
            event.__invocationSpec.triggerSpec.params.endTs.type = 'string';
            event.params = { startTs: 1, endTs: 2 };

            await assert.rejects(async () => middleware(event, resume), /endTs must be a string/);

            assert.deepStrictEqual(calls, []);
        })

        it('propagates an error the function throws', async function() {
            event.__invocationSpec.triggerSpec.params.endTs.validate = () => { throw new Error('broken check'); };
            event.params = { startTs: 1, endTs: 2 };

            await assert.rejects(async () => middleware(event, resume), /broken check/);
        })
    })

    describe('number rules', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec.params.limit = { type: 'number', optional: true, validate: { min: 1, max: 1000 } };
        })

        it('fails a number out of range', async function() {
            event.params.limit = '0';

            await assert.rejects(async () => middleware(event, resume), e => {
                assert.deepStrictEqual(e.errors, [{ parameter: 'limit', rule: 'min', message: 'limit must be at least 1' }]);

                return true;
            });
        })

        it('fails a value that is not a number', async function() {
            event.params.limit = 'lots';

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: limit must be a number/);
        })

        it('passes a blank optional argument', async function() {
            event.params.limit = '';

            await middleware(event, resume);

            assert(resumed);
        })

        it('reports a blank required argument as required', async function() {
            event.__invocationSpec.triggerSpec.params.limit.optional = false;
            event.params.limit = '';

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: limit is required/);
        })
    })

    describe('enum by type', function() {
        it('number enum matches a numeric string (GET argument)', async function() {
            event.__invocationSpec.triggerSpec.params.size = { type: 'number', validate: { enum: [1, 2, 4] } };
            event.params.size = '2';

            await middleware(event, resume);

            assert(resumed);
        })

        it('number enum fails a value that is not listed', async function() {
            event.__invocationSpec.triggerSpec.params.size = { type: 'number', validate: { enum: [1, 2, 4] } };
            event.params.size = 3;

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: size must be one of 1, 2, 4/);
        })

        it('a type without its own enum is matched exactly', async function() {
            event.__invocationSpec.triggerSpec.params.id = { type: 'uuid', validate: { enum: ['a'] } };
            event.params.id = 'b';

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: id must be one of a/);
        })
    })

    describe('array items', function() {
        function spec(items, others={}) {
            event.__invocationSpec.triggerSpec.params.tags = { type: 'array', validate: { items, ...others } };
        }

        it('checks each item against its type and rules', async function() {
            spec({ type: 'string', validate: { maxLength: 3 } });
            event.params.tags = ['a', 'abcd'];

            await assert.rejects(async () => middleware(event, resume), e => {
                assert.deepStrictEqual(e.errors, [{ parameter: 'tags', rule: 'items', message: 'tags[1] must be at most 3 characters' }]);

                return true;
            });
        })

        it('accepts string shorthand for the items spec', async function() {
            spec('number');
            event.params.tags = [1, '2', 'x'];

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: tags\[2\] must be a number/);
        })

        it('reports a missing item as required', async function() {
            spec('string');
            event.params.tags = ['a', null];

            await assert.rejects(async () => middleware(event, resume), /tags\[1\] is required/);
        })

        it('checks an item enum', async function() {
            spec({ type: 'string', validate: { enum: ['red', 'blue'] } });
            event.params.tags = ['red', 'plaid'];

            await assert.rejects(async () => middleware(event, resume), /tags\[1\] must be one of red, blue/);
        })

        it('runs an item validate function', async function() {
            spec({ type: 'string', validate: tag => tag !== 'x' || 'x is reserved' });
            event.params.tags = ['a', 'x'];

            await assert.rejects(async () => middleware(event, resume), /ParameterValidationError: x is reserved/);
        })

        it('checks items of nested arrays', async function() {
            spec({ type: 'array', validate: { items: 'number' } });
            event.params.tags = [[1, 2], [3, 'x']];

            await assert.rejects(async () => middleware(event, resume), /tags\[1\]\[1\] must be a number/);
        })

        it('passes valid items', async function() {
            spec({ type: 'string', validate: { maxLength: 3 } }, { maxItems: 2 });
            event.params.tags = ['a', 'abc'];

            await middleware(event, resume);

            assert(resumed);
        })
    })
})
