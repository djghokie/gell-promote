const sessionQueries = require('../../../gell-session/dynamodb/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');

const MockStore = require('../../../gell-aws-dynamodb/mock/store');

const { Types } = require('../../../gell-discover/domain/types');

const timeperiod = require('../../../gell-calendar/timeperiod/domain/timeperiod');
const instance = require('../../../gell-calendar/timeperiod/domain/instance');

const NAMESPACE = 'UNITTEST';

/**
 * NOTE: TIMEPERIOD and its instances are registered with the TENANT namespace, as an application would
 */
function setupTypes(deps) {
    const types = new Types();
    types.register(timeperiod.TYPE, timeperiod.model, 'TENANT');
    types.register(instance.TYPE, instance.model, 'TENANT');
    types.set('namespace', NAMESPACE, 'TENANT');

    deps.define('types', types);
}

function setupStore(deps) {
    const store = new MockStore();
    [sessionQueries, activityQueries].forEach(mod => store.queries.registerModule(mod));

    deps.define('store', store);
    this.store = store;
}

exports.NAMESPACE = NAMESPACE;

exports.beforeEach = function() {
    setupTypes(this.deps);

    setupStore.call(this, this.deps);
}
