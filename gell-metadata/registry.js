const assert = require('assert');

const State = require('gell-state').default;

const { compileParams } = require('../gell-event/binding/compiler');
const { TYPES } = require('../gell-dispatch/rules/type');

/**
 * Registry of named definitions ({ name, description, parameters, ... }), e.g. a store's named queries or operations
 *  - kind names the definitions in messages (e.g. 'query', 'operation')
 */
class Registry extends State {

    constructor(kind='definition') {
        super();

        this.kind = kind;
    }

    register(def) {
        const { kind } = this;

        assert(def && typeof def === 'object', `${kind} definition must be an object`);

        const { name } = def;

        assert(name, `${kind} must define "name" attribute to be registered`);
        assert(!this.get(name), `${kind} (name=${name}) is already registered`);

        Object.values(compileParams(def.parameters)).forEach(({ name: parameter, type }) => {
            assert(TYPES[type], `${kind} parameter type is not defined (${kind}=${name}; parameter=${parameter}; type=${type})`);
        });

        this.set(name, def);
    }

    registerModule(module) {
        Object.values(module).forEach(def => this.register(def));
    }

    names() {
        return this._internal.keys();
    }

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
    Registry
}
