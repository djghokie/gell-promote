const assert = require('assert');

const compiler = require('../../../gell-event/binding/compiler');

describe('gell-event compiler', function() {
    const validate = (endTs, { startTs }) => startTs < endTs;

    const metadata = {
        name: 'unittest.period.save',
        description: 'saves a PERIOD',
        triggers: {
            effect: {},
            action: {
                params: {
                    id: { type: 'string', optional: true },
                    title: { type: 'string', validate: { minLength: 3, messages: { minLength: 'too short' } } },
                    startTs: 'timestamp',
                    endTs: { type: 'timestamp', validate },
                },
                transaction: 'NEW',
            },
        },
    };

    describe('param', function() {
        it('compiles string shorthand as the type', function() {
            assert.deepStrictEqual(compiler.param('title', 'string'), { name: 'title', type: 'string' });
        })

        it('compiles an object spec', function() {
            assert.deepStrictEqual(
                compiler.param('id', { type: 'string', optional: true, validate: { enum: ['a'] } }),
                { name: 'id', type: 'string', optional: true, validate: { enum: ['a'] } }
            );
        })

        it('keeps non-standard properties', function() {
            assert.deepStrictEqual(compiler.param('id', { type: 'string', description: 'the id' }), { name: 'id', type: 'string', description: 'the id' });
        })

        it('compiles an array\'s items spec like a param', function() {
            assert.deepStrictEqual(
                compiler.param('tags', { type: 'array', validate: { maxItems: 3, items: 'string' } }),
                { name: 'tags', type: 'array', validate: { maxItems: 3, items: { name: 'items', type: 'string' } } }
            );
        })

        it('requires a name', function() {
            assert.throws(() => compiler.param(undefined, 'string'), /param name is required/);
        })
    })

    describe('compileParams', function() {
        it('compiles params by name', function() {
            assert.deepStrictEqual(Object.keys(compiler.compileParams(metadata.triggers.action.params)), ['id', 'title', 'startTs', 'endTs']);
            assert.deepStrictEqual(compiler.compileParams(metadata.triggers.action.params).startTs, { name: 'startTs', type: 'timestamp' });
        })

        it('compiles no params as an empty map', function() {
            assert.deepStrictEqual(compiler.compileParams(undefined), {});
        })
    })

    describe('compile', function() {
        it('keeps validate functions', function() {
            const compiled = compiler.compile(metadata);

            assert.strictEqual(compiled.triggers.action.params.endTs.validate, validate);
        })

        it('compiles context attributes like params', function() {
            const compiled = compiler.compile({ name: 'x', triggers: { action: { context: { session$: 'object' } } } });

            assert.deepStrictEqual(compiled.triggers.action.context, { session$: { name: 'session$', type: 'object' } });
        })

        it('keeps the rest of the metadata', function() {
            const compiled = compiler.compile(metadata);

            assert.strictEqual(compiled.name, 'unittest.period.save');
            assert.strictEqual(compiled.triggers.action.transaction, 'NEW');
            assert.deepStrictEqual(compiled.triggers.effect, {});
        })
    })

    describe('describe', function() {
        it('replaces validate functions', function() {
            const described = compiler.describe(metadata);

            assert.deepStrictEqual(described.triggers.action.params.endTs, { name: 'endTs', type: 'timestamp', validate: '_function_' });
        })

        it('replaces a validate function in an items spec', function() {
            const described = compiler.describe({ name: 'x', triggers: { action: { params: {
                tags: { type: 'array', validate: { items: { type: 'string', validate: tag => tag !== 'x' } } },
            } } } });

            assert.deepStrictEqual(described.triggers.action.params.tags.validate.items, { name: 'items', type: 'string', validate: '_function_' });
        })

        it('keeps validate rules', function() {
            const described = compiler.describe(metadata);

            assert.deepStrictEqual(described.triggers.action.params.title.validate, { minLength: 3, messages: { minLength: 'too short' } });
        })

        it('is serializable', function() {
            const described = compiler.describe(metadata);

            assert.deepStrictEqual(JSON.parse(JSON.stringify(described)), described);
        })

        it('does not change the metadata', function() {
            compiler.describe(metadata);

            assert.strictEqual(metadata.triggers.action.params.endTs.validate, validate);
            assert.strictEqual(metadata.triggers.action.params.startTs, 'timestamp');
        })
    })
})
