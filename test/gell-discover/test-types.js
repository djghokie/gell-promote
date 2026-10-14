const assert = require('assert');
const _ = require('lodash');

const { Types } = require('../../gell-discover/domain/types');
const type = require('./modules/type');

/**
 * WIP: starting work on a namespace aware type registry
 *  - features
 *      - discover?
 *      - register (manual)
 *      - return namespaced type name
 *          - probably define static method for this
 *      - materialize
 *      - list registered names
 *          - also namespace aware
 *      - list registered types
 * - how is this different from state?
 *      - is there any benefit to it being a state?
 *          - perhaps actor/perspectives
 * - what does a type consist of?
 * - is this a Directory abstraction?
 *      - has this been implemented before?
 */
describe('types registry', function() {
    let registry;

    beforeEach(function() {
        registry = new Types();

        // registry.set(type.TYPE, type.model);
        registry.register(type.model);
    })

    describe('type name', function() {
        it('unknown type', function() {
            const name = registry.name('GELLO');

            assert.strictEqual(name, undefined);
        })
    
        it('without namesapce', function() {
            const name = registry.name(type.TYPE);

            assert.strictEqual(name, type.TYPE);
        })

        it('with namesapce', function() {
            const name = registry.name(type.TYPE, 'TEST');

            assert.strictEqual(name, 'TEST:UNITTEST#TYPE');
        })
    })

    describe('materialize', function() {
        beforeEach(function() {
        })
    
        it('unknown type', function() {
            const item_ = registry.materialize('GELLO');

            assert.strictEqual(item_, undefined);
        })

        it('without namesapce', function() {
            const item_ = registry.materialize(type.TYPE);

            const item$ = item_.snapshot();

            assert.strictEqual(item$.type, type.TYPE);
        })

        it('with namesapce', function() {
            const item_ = registry.materialize(type.TYPE, 'TEST');

            const item$ = item_.snapshot();

            assert.strictEqual(item$.type, 'TEST:UNITTEST#TYPE');
        })

        it('with namesapce and snapshot', function() {
            const item_ = registry.materialize(type.TYPE, 'TEST', { status: 'RUNNING' });

            const item$ = item_.snapshot();

            assert.strictEqual(item$.type, 'TEST:UNITTEST#TYPE');
            assert.strictEqual(item$.status, 'RUNNING');
        })
    })

    describe('names', function() {
        beforeEach(function() {
        })
    
        it('returns stream', function() {
            const $names = registry.names();

            assert($names);

            const name = $names.next().value;

            assert.strictEqual(name, 'UNITTEST#TYPE');
        })
    })
})