const { Stereotypes } = require('gell-promote/gell-stereotype/domain/stereotypes');

exports.beforeEach = function() {
    this.stereotypes = new Stereotypes();

    this.deps.define('stereotypes', this.stereotypes)
    /*
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
        */
}
