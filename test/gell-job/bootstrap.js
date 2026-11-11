const sessionQueries = require('gell-session/dynamodb/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');
const sessionOperations = require('gell-session/dynamodb/operations');

const queryWrapper = require('gell-aws-dynamodb/query-wrapper');
const operationWrapper = require('gell-aws-dynamodb/operation-wrapper');

const MockStore = require('../../gell-aws-dynamodb/mock/store');
const discover = require('../../gell-discover/node');
const { Types } = require('../../gell-discover/domain/types');
const { Queries } = require('../../gell-discover/domain/queries');
const { Operations } = require('../../gell-discover/domain/operations');
const browser = require('../../gell-web/domain/browser');

const execution = require('../../gell-job/domain/execution');
const jobQueries = require('../../gell-job/dynamodb/queries');

const NAMESPACE = 'UNITTEST';

exports.NAMESPACE = NAMESPACE;

/**
 * Fixture project for gell-job: JOB EXECUTION registered with the ECOSYSTEM namespace, the gell-job
 * handlers on the bus, and an empty jobs map (tests register stub jobs)
 */
exports.beforeEach = function() {
    const types = new Types();
    types.register(execution.TYPE, execution.model, 'ECOSYSTEM');
    types.set('namespace', NAMESPACE, 'ECOSYSTEM');

    const queries = new Queries();
    queries.registerModule(sessionQueries);
    queries.registerModule(activityQueries);
    queries.registerModule(jobQueries);

    const operations = new Operations();
    operations.registerModule(sessionOperations);

    const store = new MockStore('type', 'id');
    Object.assign(store.namedQueries, queryWrapper.ut(queries.definitions()));
    Object.assign(store.writeOptions.namedOperations, operationWrapper.ut(operations.definitions()));

    this.deps.define('types', types);
    this.deps.define('store', store);
    this.deps.alias('store', 'sessionStore');
    this.deps.define('jobs', {});

    const { __events: events } = discover([`${__dirname}/../../gell-job`]);
    Object.keys(events).forEach(name => this.events[name] = events[name]);

    this.store = store;
    this.operator_ = browser.materialize({ userId: 'operator@example.com' });
}
