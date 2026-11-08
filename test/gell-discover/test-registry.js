const assert = require('assert');
const _ = require('lodash');

const registry = require('../../gell-discover/domain/registry');

const type = require('./modules/type');
const event = require('./modules/event');
const snapshot = require('./modules/snapshot');

/**
 * Registry.register directly (gell-discover/node.js is covered by test-node.js)
 */
describe('discovery registry', function() {

    let registry_;

    beforeEach(function() {
        registry_ = registry.materialize();
    })

    it('materializes with its type', function() {
        assert.strictEqual(registry.TYPE, 'GELL#REGISTRY');
        assert.deepStrictEqual(registry_.snapshot(), { type: 'GELL#REGISTRY' });
    })

    describe('events', function() {
        it('registers a module exporting action', function() {
            const result = registry_.register(event);

            assert.strictEqual(result, event);
            assert.strictEqual(registry_.__events['unittest.event'], event);
            assert.deepStrictEqual(Object.keys(registry_.__snapshots), []);
        })

        it('stores the metadata as a GELL#EVENT', function() {
            registry_.register(event);

            const event$ = registry_.snapshotAttribute('unittest.event');

            assert.strictEqual(event$.type, 'GELL#EVENT');
            assert.strictEqual(event$.name, 'unittest.event');
            assert.strictEqual(event$.description, event.__metadata.description);
        })

        it('does not register a module exporting only effect', function() {
            const effectOnly = {
                __metadata: { name: 'unittest.effect', triggers: { effect: {} } },
                effect: async () => {}
            };

            const result = registry_.register(effectOnly);

            // NOTE: a named module is still returned, even when nothing is registered
            assert.strictEqual(result, effectOnly);
            assert.strictEqual(registry_.get('unittest.effect'), undefined);
            assert.deepStrictEqual(Object.keys(registry_.__events), []);
        })
    })

    describe('snapshots', function() {
        it('registers a module exporting api', function() {
            const result = registry_.register(snapshot);

            assert.strictEqual(result, snapshot);
            assert.strictEqual(registry_.__snapshots['unittest.snapshot'], snapshot);
            assert.deepStrictEqual(Object.keys(registry_.__events), []);
        })

        it('stores the metadata as a GELL#EVENT', function() {
            registry_.register(snapshot);

            const snapshot$ = registry_.snapshotAttribute('unittest.snapshot');

            assert.strictEqual(snapshot$.type, 'GELL#EVENT');
            assert.strictEqual(snapshot$.name, 'unittest.snapshot');
        })

        it('registers a module exporting both action and api as an event and a snapshot', function() {
            const both = {
                __metadata: { name: 'unittest.both', triggers: { action: {}, api: {} } },
                action: async () => {},
                api: async () => {}
            };

            registry_.register(both);

            assert.strictEqual(registry_.__events['unittest.both'], both);
            assert.strictEqual(registry_.__snapshots['unittest.both'], both);
            assert.strictEqual(registry_.snapshotAttribute('unittest.both').name, 'unittest.both');
        })
    })

    describe('types', function() {
        it('registers a module exporting TYPE and a named model', function() {
            const result = registry_.register(type);

            // NOTE: type registration returns nothing (unlike events and snapshots)
            assert.strictEqual(result, undefined);
            assert.strictEqual(registry_.__types['UNITTEST#TYPE'], type);

            const type$ = registry_.snapshotAttribute('UNITTEST#TYPE');

            assert.strictEqual(type$.type, 'GELL#TYPE');
            assert.strictEqual(type$.name, 'UNITTEST#TYPE');
        })

        it('skips a model without a name', function() {
            registry_.register({ TYPE: 'UNITTEST#NONAME', model: { attributes: {} } });

            assert.deepStrictEqual(Object.keys(registry_.__types), []);
            assert.deepStrictEqual(registry_.snapshot(), { type: 'GELL#REGISTRY' });
        })

        it('skips a model without TYPE', function() {
            registry_.register({ model: { name: 'UNITTEST#NOTYPE', attributes: {} } });

            assert.deepStrictEqual(Object.keys(registry_.__types), []);
            assert.strictEqual(registry_.get('UNITTEST#NOTYPE'), undefined);
        })
    })

    describe('other modules', function() {
        it('ignores a module with neither metadata nor model', function() {
            const result = registry_.register({ helper: () => {} });

            assert.strictEqual(result, undefined);
            assert.deepStrictEqual(registry_.snapshot(), { type: 'GELL#REGISTRY' });
        })

        it('ignores metadata without a name', function() {
            registry_.register({ __metadata: {}, action: async () => {} });

            assert.deepStrictEqual(Object.keys(registry_.__events), []);
            assert.deepStrictEqual(registry_.snapshot(), { type: 'GELL#REGISTRY' });
        })
    })
})
