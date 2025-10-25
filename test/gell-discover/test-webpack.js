const assert = require('assert');
const _ = require('lodash');

const discover = require('../../gell-discover/webpack');

const PATH_TEST_MODULES = `${__dirname}/modules`

/**
 * WIP: not sure how this test can be written out of a webpack system
 *  - cant seem to mock up require.context
 */
describe.skip('webpack based discovery', function() {
    beforeEach(function() {
        require.context = function() {}
    })

    describe('base cases', function() {
        beforeEach(function() {

            console.debug('#####', require);
        })
    
        it('no paths', function() {
            const registry_ = discover();

            const registry$ = registry_.snapshot();

            assert.deepStrictEqual(registry$, { type: 'GELL#REGISTRY' });
        })
    })
})