const assert = require('assert');

const { State } = require('gell');

const javascript = require('gell-domain/binding/javascript');

const event = require('./event');
const type = require('./type');

const TYPE = "GELL#REGISTRY";

class Registry extends State {

    // __events is temporary way to expose the event modules
    __events = {}

    // __snapshots is temporary way to expose the event modules
    __snapshots = {}

    registerType(module) {
        const { TYPE, model } = module;
        const { name } = model;
        assert(TYPE, `type must export "TYPE" attribute to be registered`);
        assert(name, `type ${TYPE} model must define "name" attribute to be registered`);

        this.set(name, type.materialize(model));
    }

    registerEvent(module) {
        const { __metadata } = module;
        const { name } = __metadata;

        this.set(name, event.materialize(__metadata));

        this.__events[name] = module;
    }

    registerSnapshot(module) {
        const { __metadata } = module;
        const { name } = __metadata;

        this.set(name, event.materialize(__metadata));

        this.__snapshots[name] = module;
    }

    /**
     * WIP: register a new module
     *  -
     *      - this is needed to register events with $bus
     */
    register(module) {
        const { __metadata, model } = module;

        if (__metadata && __metadata.name) {
            if (module.action) this.registerEvent(module);
            if (module.api) this.registerSnapshot(module);

            return module;
        }

        /**
         * WIP: support legacy type definitions
         *  - no __metadata attribute
         * 
         * WIP: this should be compiling the type
         *  - inherited attributes
         *  - suitable for storing with state
         */
        if (model) this.registerType(module);
    }

}

const model = {
    class: Registry,
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
    }
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}