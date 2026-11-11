const sessionQueries = require('gell-session/dynamodb/queries');
const activeQueries = require('gell-session/dynamodb/active/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');
const sessionOperations = require('gell-session/dynamodb/operations');

const queryWrapper = require('gell-aws-dynamodb/query-wrapper');
const operationWrapper = require('gell-aws-dynamodb/operation-wrapper');

const MockStore = require('../../gell-aws-dynamodb/mock/store');
const discover = require('../../gell-discover/node');
const { Types } = require('../../gell-discover/domain/types');
const { Queries } = require('../../gell-discover/domain/queries');
const { Operations } = require('../../gell-discover/domain/operations');

const tenant = require('../../gell-namespace/domain/tenant');

const note = require('./modules/domain/note');

const TENANT_ID = 'UNITTEST';

exports.TENANT_ID = TENANT_ID;

/**
 * Fixture project for the gell-metadata snapshots: a TENANT namespaced NOTE TYPE, a registry of fixture
 * handlers (./modules), the gell-session named queries and operations, and one job
 */
const jobs = {
    'unittest.report': {
        __metadata: {
            name: 'unittest.report',
            description: 'reports fixture items',
        },
        run: async () => ({}),
    }
}

exports.jobs = jobs;

function setupTypes(deps) {
    const types = new Types();
    types.register(note.TYPE, note.model, 'TENANT');
    types.register(tenant.TYPE, tenant.model);
    types.set('namespace', TENANT_ID, 'TENANT');

    deps.define('types', types);
}

function setupStore(deps) {
    const queries = new Queries();
    queries.registerModule(sessionQueries);
    queries.registerModule(activeQueries);
    queries.registerModule(activityQueries);

    const operations = new Operations();
    operations.registerModule(sessionOperations);

    const store = new MockStore('type', 'id');
    Object.assign(store.namedQueries, queryWrapper.ut(queries.definitions()));
    Object.assign(store.writeOptions.namedOperations, operationWrapper.ut(operations.definitions()));

    deps.define('queries', queries);
    deps.define('operations', operations);
    deps.define('store', store);

    return store;
}

exports.beforeEach = async function() {
    setupTypes(this.deps);

    this.store = setupStore(this.deps);

    this.deps.define('registry', discover([`${__dirname}/modules`]));
    this.deps.define('jobs', jobs);

    this.tenant = tenant.materialize({ id: TENANT_ID, name: 'Unit Test' });
    await this.store.save(this.tenant);
}
