const sessionQueries = require('gell-session/dynamodb/queries');
const activeQueries = require('gell-session/dynamodb/active/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');

const MockStore = require('gell-aws-dynamodb/mock/store');
const queryWrapper = require('gell-aws-dynamodb/query-wrapper');

const user = require('gell-web/domain/user');

const { Types } = require('../../gell-discover/domain/types');

const webQueries = require('../../gell-web/dynamodb/queries');

const application = require('../../gell-namespace/domain/application');

function setupTypes(deps) {
    const types = new Types();
    types.register(application.TYPE, application.model);
    types.register(user.TYPE, user.model);

    deps.define("types", types);
}

function setupStore(deps) {
    const store = new MockStore();
    Object.assign(store.namedQueries,
        queryWrapper.ut(sessionQueries),
        queryWrapper.ut(activeQueries),
        queryWrapper.ut(activityQueries),
        queryWrapper.ut(webQueries),
    );
    
    deps.define('store', store);
    this.store = store;
}

exports.beforeEach = function() {
    setupTypes(this.deps);

    setupStore(this.deps);
}
