const assert = require('assert');
const _ = require('lodash');

const { Queries } = require('../../gell-discover/domain/queries');
const { Operations } = require('../../gell-discover/domain/operations');

/**
 * Queries and Operations share the same register/registerModule/names/definitions/describe behavior
 *  - NOTE: see WIP in gell-discover/domain/operations.js about sharing a base class
 */
const REGISTRIES = [
    { label: 'queries registry', Registry: Queries, kind: 'query', fn: 'query' },
    { label: 'operations registry', Registry: Operations, kind: 'operation', fn: 'operation' },
];

REGISTRIES.forEach(({ label, Registry, kind, fn }) => {
    describe(label, function() {

        let registry;

        // a definition shaped like a gell-aws-dynamodb named query/operation
        function definition(name, extra={}) {
            return {
                name,
                description: `"${name}" ${kind}`,
                parameters: {},
                [fn]: () => {},
                ...extra
            };
        }

        beforeEach(function() {
            registry = new Registry();
        })

        describe('register', function() {
            it('registers a definition by name', function() {
                const def = definition('unittest.one');

                registry.register(def);

                assert.strictEqual(registry.get('unittest.one'), def);
            })

            it('rejects a definition that is not an object', function() {
                assert.throws(() => registry.register(), new RegExp(`${kind} definition must be an object`));
                assert.throws(() => registry.register('unittest.one'), new RegExp(`${kind} definition must be an object`));
            })

            it('rejects a definition without a name', function() {
                assert.throws(() => registry.register({ description: 'no name' }), /must define "name" attribute/);
            })

            it('rejects a duplicate name', function() {
                registry.register(definition('unittest.one'));

                assert.throws(
                    () => registry.register(definition('unittest.one')),
                    /\(name=unittest.one\) is already registered/
                );
            })
        })

        describe('registerModule', function() {
            it('registers every exported definition', function() {
                registry.registerModule({
                    one: definition('unittest.one'),
                    two: definition('unittest.two'),
                });

                assert.deepStrictEqual(Array.from(registry.names()).sort(), ['unittest.one', 'unittest.two']);
            })

            it('registers by definition name, not export name', function() {
                registry.registerModule({ exportName: definition('unittest.one') });

                assert(registry.get('unittest.one'));
                assert.strictEqual(registry.get('exportName'), undefined);
            })

            it('rejects duplicates across modules', function() {
                registry.registerModule({ one: definition('unittest.one') });

                assert.throws(
                    () => registry.registerModule({ other: definition('unittest.one') }),
                    /is already registered/
                );
            })
        })

        describe('names', function() {
            it('no definitions', function() {
                assert.strictEqual(Array.from(registry.names()).length, 0);
            })

            it('lists registered names in registration order', function() {
                registry.register(definition('unittest.b'));
                registry.register(definition('unittest.a'));

                assert.deepStrictEqual(Array.from(registry.names()), ['unittest.b', 'unittest.a']);
            })
        })

        describe('definitions', function() {
            it('no definitions', function() {
                assert.deepStrictEqual(registry.definitions(), {});
            })

            it('returns the full definitions keyed by name', function() {
                const one = definition('unittest.one');
                const two = definition('unittest.two');

                registry.registerModule({ one, two });

                const defs = registry.definitions();

                assert.deepStrictEqual(Object.keys(defs).sort(), ['unittest.one', 'unittest.two']);
                assert.strictEqual(defs['unittest.one'], one);
                assert.strictEqual(defs['unittest.two'], two);
                assert.strictEqual(typeof defs['unittest.one'][fn], 'function');
            })
        })

        describe('describe', function() {
            it('requires a name', function() {
                assert.throws(() => registry.describe());
            })

            it('returns undefined for an unknown name', function() {
                assert.strictEqual(registry.describe('unittest.missing'), undefined);
            })

            it('returns plain-object metadata without functions', function() {
                registry.register(definition('unittest.one', {
                    modify: () => {},
                    filter: () => {},
                }));

                const meta = registry.describe('unittest.one');

                assert.deepStrictEqual(meta, {
                    name: 'unittest.one',
                    description: `"unittest.one" ${kind}`,
                    parameters: [],
                });
            })

            it('defaults parameters when the definition has none', function() {
                registry.register({ name: 'unittest.bare' });

                assert.deepStrictEqual(registry.describe('unittest.bare'), {
                    name: 'unittest.bare',
                    description: undefined,
                    parameters: [],
                });
            })

            it('normalizes string and object parameters', function() {
                registry.register(definition('unittest.params', {
                    parameters: {
                        id: 'string',
                        status: { type: 'string', optional: true },
                        limit: { type: 'number' },
                    }
                }));

                const { parameters } = registry.describe('unittest.params');

                assert.deepStrictEqual(parameters, [
                    { name: 'id', type: 'string', optional: false },
                    { name: 'status', type: 'string', optional: true },
                    { name: 'limit', type: 'number', optional: false },
                ]);
            })
        })
    })
})
