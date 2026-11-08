const assert = require('assert');

const { State } = require('gell');

/**
 * Registry of gell-aws-dynamodb named query definitions ({ name, description, parameters, filter, query })
 *
 * NOTE: store.namedQueries only holds the wrapped query functions; this keeps the full definitions so
 * the store's queries and their metadata come from the same source
 *
 * WIP:
 *  - should this be a Directory implementation (see Types.names)?
 *  - compile parameters with gell-domain (see query-wrapper validateArguments)?
 */
class Queries extends State {

    register(def) {
        assert(def && typeof def === 'object', `query definition must be an object`);

        const { name } = def;

        assert(name, `query must define "name" attribute to be registered`);
        assert(!this.get(name), `query (name=${name}) is already registered`);

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
     * full definitions keyed by name; wrap with queryWrapper.dynamodb/ut before assigning to store.namedQueries
     */
    definitions() {
        const defs = {};

        for (const name of this.names()) defs[name] = this.get(name);

        return defs;
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
