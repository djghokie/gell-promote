const sessionQueries = require('gell-session/dynamodb/queries');
const activeQueries = require('gell-session/dynamodb/active/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');
const webQueries = require('../../gell-web/dynamodb/queries');

const MockStore = require('gell-aws-dynamodb/mock/store');
const queryWrapper = require('gell-aws-dynamodb/query-wrapper');

const user = require('gell-web/domain/user');

const { Types } = require('../../gell-discover/domain/types');

const tenant = require('../../gell-namespace/domain/tenant');
const application = require('../../gell-namespace/domain/application');
const member = require('../../gell-web/member/domain/member');

function setupTypes(deps) {
    const types = new Types();
    types.register(tenant.TYPE, tenant.model);
    types.register(application.TYPE, application.model);
    types.register(user.TYPE, user.model);
    types.register(member.TYPE, member.model, 'APPLICATION');

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
