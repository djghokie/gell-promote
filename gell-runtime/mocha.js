const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');

const DependencyContainer = require('gell-dependency/container');
const discover = require('../gell-discover/node');
const { Types } = require('../gell-discover/domain/types');

const { runtimeLogger } = require('gell-runtime/logger');

const bus = require('gell-dispatch/bus');
const resolver = require('../gell-stereotype/dispatch/resolver');
const stereotypeMiddleware = require('../gell-stereotype/middleware/extension');
const attributeMiddleware = require('gell-dispatch/middleware/attributes');
const argumentMiddleware = require('gell-dispatch/middleware/arguments');
const transactionMiddleware = require('../gell-aws-dynamodb/middleware/transaction');

/**
 * Mocha runtime for unit tests: dispatches events the way a Next.js app's API routes do
 *
 * NOTE: re-implementation of gell-runtime/mocha; differences from it, to match the app's buses
 *  - uses gell-dispatch/bus (each invocation gets its own branch of deps) instead of the legacy gell-session bus
 *  - runs the app's generic middleware by default (attributes, arguments, transaction, in the app's order), after
 *    gell-stereotype's extension middleware; a suite adds app specific middleware (e.g. gell-namespace
 *    types/namespace) to this.middleware before its first dispatch
 *  - two catalogs and buses, like the app: this.events (modules exporting action) on $actions, this.snapshots
 *    (modules exporting api) on $snapshots
 *  - this.action(trigger) dispatches on $actions and this.snapshot(trigger) on $snapshots; a trigger is a route
 *    string or { route, caller, params, context, deps } (deps defaults to this.deps)
 *  - replaces gell-runtime/mocha's this.dispatch, this.event and this.action(caller, params)
 *
 * usage
 *      before(runtime.beforeAll);
 *      beforeEach(function() { this.discover(`${__dirname}/../gell-namespace`) });
 *      await this.action({ route: 'namespace.application.create#action', caller, params });
 *      await this.snapshot({ route: 'namespace.applications.active#api', caller, params });
 *
 * WIP: buses are dependency singletons built on first dispatch, so middleware added after it is ignored
 * 
 * WIP: not sure this belongs in gell-runtime
 *  - these are mostly gell-dispatch related features
 *
 */
exports.MIDDLEWARE = [
    stereotypeMiddleware,
    attributeMiddleware,
    argumentMiddleware,
    transactionMiddleware,
];

exports.beforeAll = function() {
    const logger = runtimeLogger('unittest');
    this.logger = logger;

    this.types = new Types();
    this.events = {};
    this.snapshots = {};

    this.middleware = [...exports.MIDDLEWARE];

    this.deps = new DependencyContainer({
        logger,

        types: this.types,

        // NOTE: regular routes resolve in the catalogs above; stereotyped routes (EXTENSION$stereotype.event#trigger)
        // through the stereotypes dependency (optional; see gell-stereotype/ut/mocha)
        $actions: deps => {
            const [$resolver] = init(resolver.object(this.events, { deps, catalog: 'actions' }));

            return init(bus($resolver, this.middleware, deps))[0];
        },
        $snapshots: deps => {
            const [$resolver] = init(resolver.object(this.snapshots, { deps, catalog: 'snapshots' }));

            return init(bus($resolver, this.middleware, deps))[0];
        },
    })

    this.registerType = function(typeModule, namespace) {
        assert(typeModule.TYPE);

        this.types.register(typeModule.TYPE, typeModule.model, namespace);
    }

    this.registerAction = function(def) {
        assert(def.__metadata.name);

        this.events[def.__metadata.name] = def;
    }

    this.registerSnapshot = function(def) {
        assert(def.__metadata.name);

        this.snapshots[def.__metadata.name] = def;
    }

    this.discover = function(...paths) {
        const registry_ = discover(paths);
    
        const { __events: events={}, __snapshots: snapshots={} } = registry_;

        Object.assign(this.events, events);
        Object.assign(this.snapshots, snapshots);
    }

    this.action = function(arg) {
        const trigger = _.isString(arg) ? { route: arg } : { ...arg };

        // NOTE: most tests will branch dependencies in beforeEach
        if (!trigger.deps) trigger.deps = this.deps;

        const $bus = this.deps.resolveSingle('$actions');

        return $bus.next(trigger).value;
    }

    this.snapshot = function(arg) {
        const trigger = _.isString(arg) ? { route: arg } : { ...arg };

        // NOTE: most tests will branch dependencies in beforeEach
        if (!trigger.deps) trigger.deps = this.deps;

        const $bus = this.deps.resolveSingle('$snapshots');

        return $bus.next(trigger).value;
    }
}
