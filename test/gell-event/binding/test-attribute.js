const assert = require('assert');

const { attribute, findAttribute } = require('../../../gell-event/binding/attribute');
const { compileParams, describe: describeMetadata } = require('../../../gell-event/binding/compiler');

const base = {
    name: 'TEST#BASE',
    attributes: {
        id: 'uuid',
        title: { type: 'string', validate: { maxLength: 10 } },
    },
};

const model = {
    name: 'TEST#THING',
    extends: [base],
    attributes: {
        title: { type: 'string', default: '', validate: { minLength: 3, maxLength: 100, messages: { minLength: 'too short' } } },
        color: { type: 'string', default: 'red', validate: { enum: ['red', 'blue'] } },
        code: { type: 'string', validate: code => code === code.toUpperCase() || 'code must be upper case' },
        label: (thing_) => thing_.get('title'),
    },
};

describe('attribute', function() {
    it('a param from an attribute, naming its source', function() {
        assert.deepStrictEqual(attribute(model, 'color'), { type: 'string', validate: { enum: ['red', 'blue'] }, attribute: 'TEST#THING.color' });
    })

    it('leaves out the attribute default', function() {
        assert.strictEqual('default' in attribute(model, 'title'), false);
    })

    it('a shorthand attribute', function() {
        assert.deepStrictEqual(attribute(model, 'id'), { type: 'uuid', attribute: 'TEST#THING.id' });
    })

    it('finds inherited attributes, own first', function() {
        assert.strictEqual(findAttribute(model, 'id'), 'uuid');
        assert.strictEqual(findAttribute(model, 'title').validate.minLength, 3);
        assert.strictEqual(findAttribute(base, 'title').validate.maxLength, 10);
    })

    it('applies overrides', function() {
        assert.deepStrictEqual(attribute(model, 'color', { optional: true, description: 'card color' }), {
            type: 'string', validate: { enum: ['red', 'blue'] }, optional: true, description: 'card color', attribute: 'TEST#THING.color',
        });
    })

    it('merges override rules and messages', function() {
        assert.deepStrictEqual(attribute(model, 'title', { validate: { maxLength: 20, messages: { maxLength: 'too long' } } }).validate, {
            minLength: 3, maxLength: 20, messages: { minLength: 'too short', maxLength: 'too long' },
        });
    })

    it('an override validate function replaces the rules', function() {
        const validate = () => true;
        assert.strictEqual(attribute(model, 'title', { validate }).validate, validate);
    })

    it('keeps a validate function', function() {
        assert.strictEqual(typeof attribute(model, 'code').validate, 'function');
    })

    it('rejects an unknown attribute', function() {
        assert.throws(() => attribute(model, 'nope'), /has no attribute \(name=nope\)/);
    })

    it('rejects a derived attribute', function() {
        assert.throws(() => attribute(model, 'label'), /is derived/);
    })

    it('does not share the model rules', function() {
        const param = attribute(model, 'title', { validate: { maxLength: 5 } });
        assert.strictEqual(model.attributes.title.validate.maxLength, 100);
        assert.notStrictEqual(param.validate, model.attributes.title.validate);
    })

    it('survives compile and describe', function() {
        const params = compileParams({ color: attribute(model, 'color', { optional: true }) });
        assert.strictEqual(params.color.attribute, 'TEST#THING.color');
        assert.deepStrictEqual(params.color.validate, { enum: ['red', 'blue'] });

        const described = describeMetadata({ name: 'x', triggers: { action: { params: { code: attribute(model, 'code') } } } });
        assert.strictEqual(described.triggers.action.params.code.validate, '_function_');
        assert.strictEqual(described.triggers.action.params.code.attribute, 'TEST#THING.code');
    })
})
