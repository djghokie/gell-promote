const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const registry = require('../../../gell-discover/domain/registry');
const inspect = require('../../../gell-discover/snapshot/inspect');

const event = require('../modules/event');

describe('gell inspect snapshot', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        const registry_ = registry.materialize();
        registry_.register(event);

        this.deps.define('registry', registry_);
    })

    it('metadata', function() {
        assert.strictEqual(inspect.__metadata.name, 'gell.inspect');
    })

    describe('api', function() {
        it('returns the named registry entry', async function() {
            const event_ = await inspect.api({
                params: { name: 'unittest.event' },
                deps: this.deps
            });

            assert.strictEqual(event_.snapshotAttribute('name'), 'unittest.event');
        })

        it('returns undefined for an unknown name', async function() {
            const result = await inspect.api({
                params: { name: 'unittest.missing' },
                deps: this.deps
            });

            assert.strictEqual(result, undefined);
        })

        it('requires a name', async function() {
            await assert.rejects(inspect.api({ deps: this.deps }));
        })
    })

    describe('effect', function() {
        it('returns the named registry entry', async function() {
            const event_ = await inspect.effect({
                params: { name: 'unittest.event' },
                deps: this.deps
            });

            assert.strictEqual(event_.snapshotAttribute('name'), 'unittest.event');
        })

        it('requires a name', async function() {
            await assert.rejects(inspect.effect({ deps: this.deps }));
        })
    })
})
