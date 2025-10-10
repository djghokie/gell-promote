const assert = require('assert');
const _ = require('lodash');

const discover = require('../../gell-discover');

const PATH_TEST_MODULES = `${__dirname}/modules`

describe('module discovery', function() {
    beforeEach(function() {
    })

    describe('base cases', function() {
        beforeEach(function() {
        })
    
        it('no paths', function() {
            const registry_ = discover();

            const registry$ = registry_.snapshot();

            assert.deepStrictEqual(registry$, { type: 'GELL#REGISTRY' });
        })
    })

    describe('test modules', function() {
        beforeEach(function() {
        })
    
        it('discovers event correctly', function() {
            const registry_ = discover([PATH_TEST_MODULES]);

            // console.debug('#####', registry_.snapshot());

            const event$ = registry_.snapshotAttribute('unittest.event');

            assert.strictEqual(event$.name, 'unittest.event');
        })

        it('stores event module with registry', async function() {
            const registry_ = discover([PATH_TEST_MODULES]);

            const { __events } = registry_;

            assert.strictEqual(Object.keys(__events).length, 1);
        })

        it('discovers type correctly', function() {
            const registry_ = discover([PATH_TEST_MODULES]);

            // console.debug('#####', registry_.snapshot());

            const type$ = registry_.snapshotAttribute('UNITTEST#TYPE');

            assert.strictEqual(type$.name, 'UNITTEST#TYPE');
        })

        it('discovers snapshot correctly', function() {
            const registry_ = discover([PATH_TEST_MODULES]);

            // console.debug('#####', registry_.snapshot());

            const type$ = registry_.snapshotAttribute('unittest.snapshot');

            assert.strictEqual(type$.name, 'unittest.snapshot');
        })
    })
})