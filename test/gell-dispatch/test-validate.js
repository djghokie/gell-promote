const assert = require('assert');

const { argument, object } = require('../../gell-dispatch/validate');
const number = require('../../gell-dispatch/rules/number');
const { TYPES } = require('../../gell-dispatch/rules/type');

/**
 * Matches the RuleValidationError argument throws
 */
function ruleFailure(rule, message) {
    return e => {
        assert.strictEqual(e.name, 'RuleValidationError');
        assert.strictEqual(e.rule, rule);
        assert.strictEqual(e.message, message);

        return true;
    }
}

/**
 * Matches the ObjectValidationError object throws
 */
function objectFailure(errors) {
    return e => {
        assert.strictEqual(e.name, 'ObjectValidationError');
        assert.deepStrictEqual(e.errors, errors);
        assert.strictEqual(e.message, errors.map(({ message }) => message).join('; '));

        return true;
    }
}

describe('gell-dispatch/validate', function() {
    describe('argument', function() {
        it('throws for a value that fails a rule', function() {
            assert.throws(() => argument(10, { max: 5 }, number), ruleFailure('max', 'must be at most 5'));
        })

        it('passes a value that passes its rules', function() {
            assert.strictEqual(argument(10, { min: 1 }, number), 10);
        })

        it('coerces the value first and returns it', function() {
            assert.strictEqual(argument('10', { min: 5 }, number), 10);
            assert.strictEqual(argument('true', undefined, TYPES.boolean), true);
            assert.deepStrictEqual(argument('{"city":"Denver"}', { requiredKeys: ['city'] }, TYPES.object), { city: 'Denver' });
        })

        it('returns a value of a type without coerce as it is', function() {
            assert.strictEqual(argument('abc', { minLength: 2 }, TYPES.string), 'abc');
        })

        it("checks the type's default rules", function() {
            assert.throws(() => argument('abc', undefined, number), ruleFailure('isNumber', 'must be a number'));
            assert.throws(() => argument(1.5, undefined, TYPES.integer), ruleFailure('isInteger', 'must be an integer'));
        })

        it('returns a blank value of a type that allows blanks as sent, without its rules', function() {
            assert.strictEqual(argument('', { min: 5 }, number), '');
            assert.strictEqual(argument(null, { min: 5 }, number), null);
        })

        it('takes a TYPE from TYPES or a TYPE definition', function() {
            assert.strictEqual(argument('3', { positive: true }, TYPES.integer), 3);
            assert.strictEqual(argument('3', { positive: true }, require('../../gell-dispatch/rules/integer')), 3);
        })

        it('coerces rule arguments', function() {
            assert.strictEqual(argument(2, { enum: ['1', '2'] }, number), 2);
        })

        it('fails an assert for a rule the type does not define', function() {
            assert.throws(() => argument(1, { minLength: 1 }, number), e => e.name === 'AssertionError' && /no rule defined \(type=number; rule=minLength\)/.test(e.message));
        })

        it('fails an assert for a bad rule argument', function() {
            assert.throws(() => argument(1, { max: 'lots' }, number), e => e.name === 'AssertionError' && /rule argument is not a valid number \(type=number; rule=max/.test(e.message));
        })

        it('requires a ruleDef', function() {
            assert.throws(() => argument(1, { max: 5 }), /ruleDef is required/);
        })
    })

    describe('object', function() {
        const SPEC = {
            title: { type: 'string', validate: { minLength: 3 } },
            seats: { type: 'integer', optional: true, validate: { positive: true, max: 12 } },
            note: 'string',
        };

        it('returns a copy with coerced property values', function() {
            const obj = { title: 'Lunch', seats: '4', note: 'by the window', other: 'kept' };
            const result = object(obj, SPEC);

            assert.deepStrictEqual(result, { title: 'Lunch', seats: 4, note: 'by the window', other: 'kept' });
            assert.notStrictEqual(result, obj);
            assert.strictEqual(obj.seats, '4');
        })

        it('reports every failing property, each named', function() {
            assert.throws(() => object({ title: 'ab', seats: 13, note: 7 }, SPEC), objectFailure([
                { property: 'title', rule: 'minLength', message: 'title must be at least 3 characters' },
                { property: 'seats', rule: 'max', message: 'seats must be at most 12' },
                { property: 'note', rule: 'isString', message: 'note must be a string' },
            ]));
        })

        it('reports a missing required property', function() {
            assert.throws(() => object({ seats: 2 }, SPEC), objectFailure([
                { property: 'title', rule: 'required', message: 'title is required' },
                { property: 'note', rule: 'required', message: 'note is required' },
            ]));
        })

        it('counts a blank required property as missing', function() {
            assert.throws(() => object({ title: '', note: null }, SPEC), objectFailure([
                { property: 'title', rule: 'required', message: 'title is required' },
                { property: 'note', rule: 'required', message: 'note is required' },
            ]));
        })

        it('does not check an omitted optional property', function() {
            assert.deepStrictEqual(object({ title: 'Lunch', note: 'x' }, SPEC), { title: 'Lunch', note: 'x' });
        })

        it('checks a blank optional property against its type', function() {
            assert.deepStrictEqual(object({ title: 'Lunch', note: 'x', seats: '' }, SPEC), { title: 'Lunch', note: 'x', seats: '' });
            assert.throws(() => object({ code: '' }, { code: { type: 'string', optional: true, validate: { minLength: 2 } } }), objectFailure([
                { property: 'code', rule: 'minLength', message: 'code must be at least 2 characters' },
            ]));
        })

        it('uses validate.messages to override a message', function() {
            const spec = { title: { type: 'string', validate: { minLength: 3, messages: { minLength: 'title is too short', required: 'a title, please' } } } };

            assert.throws(() => object({ title: 'ab' }, spec), objectFailure([{ property: 'title', rule: 'minLength', message: 'title is too short' }]));
            assert.throws(() => object({}, spec), objectFailure([{ property: 'title', rule: 'required', message: 'a title, please' }]));
        })

        it('takes its own rule definitions', function() {
            const WORD = { name: 'word', rules: { isWord: { test: val => /^\w+$/.test(val), message: () => 'must be one word' } }, default: ['isWord'] };

            assert.deepStrictEqual(object({ tag: 'blue' }, { tag: 'word' }, { word: WORD }), { tag: 'blue' });
            assert.throws(() => object({ tag: 'light blue' }, { tag: 'word' }, { word: WORD }), objectFailure([{ property: 'tag', rule: 'isWord', message: 'tag must be one word' }]));
        })

        it('fails an assert for a type it does not define', function() {
            assert.throws(() => object({ id: 'x' }, { id: 'uuid' }), e => e.name === 'AssertionError' && /no type defined \(property=id; type=uuid\)/.test(e.message));
        })

        it('fails an assert for a validate function', function() {
            assert.throws(() => object({ id: 'x' }, { id: { type: 'string', validate: () => true } }), /validate must be a map of rules \(property=id\)/);
        })

        it('fails an assert for a mistake in the rules', function() {
            assert.throws(() => object({ seats: 1 }, { seats: { type: 'integer', validate: { minLength: 1 } } }), e => e.name === 'AssertionError');
        })

        it('requires an object and a spec', function() {
            assert.throws(() => object('x', SPEC), /obj must be an object/);
            assert.throws(() => object({}), /spec must be an object/);
        })
    })
})
