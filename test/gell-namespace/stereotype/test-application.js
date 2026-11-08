const assert = require('assert');

const sessionQueries = require('gell-session/dynamodb/queries');
const activeQueries = require('gell-session/dynamodb/active/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');

const MockStore = require('gell-aws-dynamodb/mock/store');
const queryWrapper = require('gell-aws-dynamodb/query-wrapper');

const runtime = require('../../../gell-runtime/mocha');
const stereotypeFixtures = require('../../../gell-stereotype/ut/mocha');

const ecosystem = require('gell-promote/gell-namespace/domain/ecosystem');
const application = require('gell-promote/gell-namespace/stereotype/application');

/**
 * NOTE: unlike test-applications, NAMESPACE#APPLICATION is not registered with the types registry, so the APPLICATION
 * model comes from the extension's type extension of GELL#NAMESPACE
 */
describe('APPLICATION extension of the namespace stereotype', function() {
    before(runtime.beforeAll);
    beforeEach(stereotypeFixtures.beforeEach);

    let ecosystem_;

    beforeEach(function() {
        const store = new MockStore();
        Object.assign(store.namedQueries,
            queryWrapper.ut(sessionQueries),
            queryWrapper.ut(activeQueries),
            queryWrapper.ut(activityQueries),
        );

        this.deps.define('store', store);

        this.stereotypes.register(application);

        ecosystem_ = ecosystem.materialize({ id: 'INCUBATOR' });
    })

    it('creates an APPLICATION from the type extension', async function() {
        assert(!this.types.get('NAMESPACE#APPLICATION'));

        const application_ = await this.action({
            route: 'APPLICATION$namespace.create#action',
            params: { name: 'Unit Test Web', relativeId: 'WEB' },
            context: { ecosystem_ },
        });

        assert.deepStrictEqual(application_.snapshotPartial(['id', 'type', 'parentId', 'name', 'status']), {
            id: 'INCUBATOR:WEB',
            type: 'NAMESPACE#APPLICATION',
            parentId: 'INCUBATOR',
            name: 'Unit Test Web',
            status: 'ACTIVE',
        });
    })

    it('lists active APPLICATIONs', async function() {
        await this.action({
            route: 'APPLICATION$namespace.create#action',
            params: { name: 'Unit Test Web', relativeId: 'WEB' },
            context: { ecosystem_ },
        });

        const applications_ = await this.snapshot({ route: 'APPLICATION$namespaces.active#api' });

        assert.deepStrictEqual(applications_.map(a => a.id), ['INCUBATOR:WEB']);
    })

    it('rejects a regular dispatch of namespace.create', async function() {
        this.registerAction(require('gell-promote/gell-namespace/action/create'));

        await assert.rejects(this.action({
            route: 'namespace.create#action',
            params: { name: 'Unit Test Web', relativeId: 'WEB' },
            context: { ecosystem_ },
        }), { name: 'ExtensionRequiredError' });
    })
})
