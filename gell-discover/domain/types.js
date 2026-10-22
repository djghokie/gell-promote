const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const javascript = require('gell-domain/binding/javascript');

const DEFAULT_DELIMETER = '::';

class Types extends State {

    delimeter = DEFAULT_DELIMETER;

    defs = {};
    
    namespacedTypes = {};

    /**
     * NOTES
     *  - also registers model
     *  - alias is optional and is a short name for the namespace
     * 
     * @param {*} namm 
     * @param {*} model 
     * @param {*} alias 
     */
    defineNamespace(namm, model, alias) {}

    /**
     * WIP:
     *  - not sure if this is going to be called "register" or "define"
     *  - namespaces must be registered?
     * 
     * @param {*} name unique string in this registry
     * @param {*} model 
     * @param {*} namespace optional namespace applied to instances
     */
    register(name, model, namespace) {
        assert(_.isString(name));
        assert(_.isObject(model));

        this.defs[name] = model;

        // this.set(name, type.materialize(model));
        this.set(name, model);

        if (namespace) {
            assert(_.isString(namespace));

            this.namespacedTypes[name] = namespace;
        }
    }

    /**
     * WIP: this should probably be pushed up to a Directory implementation
     */
    names() {
		// return this._internal.keys();
        return Object.keys(this.defs);
    }

    name(n) {
        assert(_.isString(n), 'name argument must be string');

        // assert(this.get(n), `type (name=${n}) is not defined`);

        const namespace = this.namespacedTypes[n];

        // console.debug('#####', name, namespace);
        
        if (namespace) {
            const namespaceId = this.snapshotAttribute(namespace);
            
            // console.debug('#####', namespaceId);

            // WIP: unclear if this should throw or just returne the non-namespaced instance
            assert(_.isString(namespaceId), `namespace (name=${namespace}) is not defined`);

            return `${namespaceId}::${n}`;
        }

        return n;
    }

    /**
     * Instantiates a instance of a type registered with this registry
     * 
     * WIP: still isn't 100% clear how the type attribute should be generated
     *  - based on type defined by model?
     *  - based on name?
     *      - this is what we're going with right now
     * 
     * @param {*} name the name of the type
     * @param {*} state$ 
     * @returns 
     */
    instance(name, state$) {
        assert(_.isString(name), 'name argument must be string');

        const model = this.defs[name];
        assert(model, `no type (name=${name}) defined`);

        const instance_ = javascript.materialize(state$, model);

        // const type$ = instance_.snapshotAttribute('type');
        instance_.set('type', this.name(name));

        return instance_;
    }

    /**
     * WIP:
     *  - clone is probably the wrong name
     *  - should namespaces be passed in here?
     *      - maybe as a map?
     * 
     * @returns cloned types registry
     */
    clone() {
        const namespacedTypes = new Types();
        namespacedTypes.defs = this.defs;
        namespacedTypes.namespacedTypes = this.namespacedTypes;

        return namespacedTypes;
    }

}

/*
const model = {
    class: Types,
    attributes: {
    }
}
*/

module.exports = {
    Types,
    // model,
    // materialize: session$ => javascript.materialize(session$, model)
}