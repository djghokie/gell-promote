const assert = require('assert');

const { State } = require('gell');

const { compileParams } = require('../../gell-event/binding/compiler');
const { TYPES } = require('../../gell-dispatch/rules/type');

/**
 * Registry of gell-aws-dynamodb named query definitions ({ name, description, parameters, filter, query })
 *
 * NOTE: the store (gell-promote/gell-aws-dynamodb store, mock/store) creates one (store.queries) and looks its
 * query definitions up in it, so the store's queries and their metadata come from the same source; register asserts
 * every parameter type is defined (gell-dispatch/rules/type TYPES)
 *
 * WIP:
 *  - should this be a Directory implementation (see Types.names)?
 *  - compile parameters with gell-domain (see gell-aws-dynamodb/named, which checks them like params)?
 */
class Queries extends State {

    register(def) {
        assert(def && typeof def === 'object', `query definition must be an object`);

        const { name } = def;

        assert(name, `query must define "name" attribute to be registered`);
        assert(!this.get(name), `query (name=${name}) is already registered`);

        Object.values(compileParams(def.parameters)).forEach(({ name: parameter, type }) => {
            assert(TYPES[type], `query parameter type is not defined (query=${name}; parameter=${parameter}; type=${type})`);
        });

        this.set(name, def);
    }

    /**
     * registers every definition exported by a query module (e.g. bhi-core/queries)
     */
    registerModule(queries) {
        Object.values(queries).forEach(def => this.register(def));
    }

    names() {
        return this._internal.keys();
    }

    /**
     * plain-object metadata for a query (no filter/query functions)
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
    Queries,
}
