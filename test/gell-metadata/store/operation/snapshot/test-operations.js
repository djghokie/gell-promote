const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const Store = require('../../../../../gell-aws-dynamodb/mock/store');

const operationsSnapshot = require('../../../../../gell-metadata/store/operation/snapshot/operations');
const operationSnapshot = require('../../../../../gell-metadata/store/operation/snapshot/operation');

const OPERATIONS = {
    touch: {
        name: 'unittest.touch',
        description: 'updates updatedTs',
        parameters: { ts: { type: 'timestamp', optional: true } },
        modify: () => {},
        operation: () => {},
    },
    end: {
        name: 'unittest.end',
        description: 'ends an item',
        modify: () => {},
        operation: () => {},
    },
}

describe('gell-metadata store operations', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        const store = new Store('type', 'id');
        store.operations.registerModule(OPERATIONS);

        this.deps.define('store', store);
    })

    describe('gell.domain.operations', function() {
        it('returns metadata of every registered operation, sorted by name', async function() {
            const operations$ = await operationsSnapshot.api({ params: {}, deps: this.deps });

            assert.deepStrictEqual(operations$, [
                { name: 'unittest.end', description: 'ends an item', parameters: [] },
                {
                    name: 'unittest.touch',
                    description: 'updates updatedTs',
                    parameters: [
                        { name: 'ts', type: 'timestamp', optional: true },
                    ],
                },
            ]);
        })
    })

    describe('gell.domain.operation', function() {
        it('returns operation metadata by name', async function() {
            const operation$ = await operationSnapshot.api({ params: { name: 'unittest.touch' }, deps: this.deps });

            assert.deepStrictEqual(operation$, {
                name: 'unittest.touch',
                description: 'updates updatedTs',
                parameters: [{ name: 'ts', type: 'timestamp', optional: true }],
            });
        })

        it('reports an unknown operation as 404', async function() {
            await assert.rejects(operationSnapshot.api({ params: { name: 'unittest.missing' }, deps: this.deps }), { status: 404, message: 'operation not found (name=unittest.missing)' });
        })
    })
})
