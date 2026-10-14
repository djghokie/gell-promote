const assert = require('assert');

const { State } = require('gell');

const javascript = require('gell-domain/binding/javascript');

const type = require('./type');

const DELIMETER = ':';

class Types extends State {

    /**
     * WIP:
     *  - call this "define" instead?
     */
    register(model) {
        const { name } = model;

        assert(name, `model must define "name" attribute to be registered`);

        // this.set(name, type.materialize(model));
        this.set(name, model);
    }

    /**
     * WIP: should this take "caller" or "namespace"?
     *      - namespace might be more flexible
     *          - could be string, function, etc
     *          - would require more work by APIs
     */
    name(registeredName, namespace) {
        assert(registeredName);

        const model$ = this.get(registeredName);

        if (model$) {
            return namespace ? `${namespace}${DELIMETER}${registeredName}` : registeredName;
        }
    }

    materialize(registeredName, namespace, state$) {
        assert(registeredName);

        const model$ = this.get(registeredName);

        if (model$) {
            const state_ = javascript.materialize(state$, model$);

            /**
             * WIP:
             *  - use perspectives here?
             *  - allow for multiple namespaced attributes?
             */
            if (namespace) {
                const type$ = state_.snapshotAttribute('type');

                state_.set('type', z => `${namespace}${DELIMETER}${registeredName}`);
            }

            return state_;
        }
    }

    /**
     * WIP: this should probably be pushed up to a Directory implementation
     */
    names() {
		return this._internal.keys();
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