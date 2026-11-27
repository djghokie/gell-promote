const assert = require('assert');

const { State } = require('gell');

/**
 * Registry of gell-aws-dynamodb named operation definitions ({ name, description, parameters, modify, operation })
 *
 * NOTE: the store (gell-promote/gell-aws-dynamodb) holds these definitions as registered (configureOperations); this keeps them so
 * the store's operations and their metadata come from the same source
 *
 * WIP:
 *  - share a base class with Queries? register/registerModule/names/definitions/describe are identical
 *  - compile parameters with gell-domain (see gell-aws-dynamodb/named, which checks them like params)?
 */
class Operations extends State {

    register(def) {
        assert(def && typeof def === 'object', `operation definition must be an object`);

        const { name } = def;

        assert(name, `operation must define "name" attribute to be registered`);
        assert(!this.get(name), `operation (name=${name}) is already registered`);

        this.set(name, def);
    }

    /**
     * registers every definition exported by an operation module (e.g. gell-session/dynamodb/operations)
     */
    registerModule(operations) {
        Object.values(operations).forEach(def => this.register(def));
    }

    names() {
        return this._internal.keys();
    }

    /**
     * full definitions keyed by name; add to a store with store.configureOperations
     */
    definitions() {
        const defs = {};

        for (const name of this.names()) defs[name] = this.get(name);

        return defs;
    }

    /**
     * plain-object metadata for an operation (no modify/operation functions)
     */
    describe(name) {
        assert(name);

        const def = this.get(name);

        if (!def) return;

        const { description, parameters={} } = def;

        return {
            name,
            description,
            parameters: Object.keys(parameters).map(p => {
                const param = parameters[p];
                const { type, optional=false } = typeof param === 'string' ? { type: param } : param;

                return { name: p, type, optional };
            }),
        };
    }

}

module.exports = {
    Operations,
}
