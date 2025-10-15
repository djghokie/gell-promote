const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const queries = require('../../../gell-discover/snapshot/queries');

describe('gell queries snapshot', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        this.deps.define('queryRegistry', {});
    })

    it('works', async function() {
        await queries.api({
            deps: this.deps
        });
    })
})