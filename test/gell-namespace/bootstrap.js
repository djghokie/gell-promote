const sessionQueries = require('../../gell-session/dynamodb/queries');
const activeQueries = require('gell-session/dynamodb/active/queries');
const activityQueries = require('gell-session/dynamodb/activity/queries');

const MockStore = require('../../gell-aws-dynamodb/mock/store');

const tenant = require('../../gell-namespace/domain/tenant');
const application = require('../../gell-namespace/domain/application');

function setupTypes() {
    this.registerType(tenant);
    this.registerType(application);
}

function configureEvents() {
    this.discover(
        // `${__dirname}/../../gell-namespace`
    );
}

function setupStore() {
    const store = new MockStore();
    store.configureQueries(
        sessionQueries,
        activeQueries,
        activityQueries,
    );
    
    this.deps.define('store', store);
    this.store = store;
}

exports.beforeEach = function() {
    [
        setupTypes,
        configureEvents,
        setupStore
    ].forEach(f => f.bind(this)());
}
