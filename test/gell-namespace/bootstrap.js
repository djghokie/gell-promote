const MockStore = require('gell-aws-dynamodb/mock/store');

const { Types } = require('../../gell-discover/domain/types');

const tenant = require('../../gell-namespace/domain/tenant');
const application = require('../../gell-namespace/domain/application');

function setupTypes(deps) {
    const types = new Types();
    types.register(tenant.TYPE, tenant.model);
    types.register(application.TYPE, application.model);

    deps.define("types", types);
}

function setupStore(deps) {
    const store = new MockStore();

    deps.define('store', store);
    this.store = store;
}

exports.beforeEach = function() {
    setupTypes(this.deps);

    setupStore(this.deps);
}
