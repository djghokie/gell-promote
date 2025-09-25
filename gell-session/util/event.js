const assert = require('assert');
const _ = require('lodash');

const lookup = require('gell-session/snapshot/lookup');
const update = require('gell-session/event/update');

/**
 * WIP: idea here is that we have a standard approach to basic session update event
 *  - trying to cut down on boilerplate code
 *  - based on a type (domain)
 *  - suppose this could be a class/instance
 *  - this could also be solved by have additional context attributes to lookup
 *      - type attribute
 *      - could also support both approaches
 *  - could further extend this by automatically generating events
 *      - would need some sort of type registration process
 *      - automatically add to $bus
 *  - for now, target to gell-session/util folder
 *      - this may be a new gell package
 *      - not sure "util" is the right folder
 * 
 * WIP: additional features to support
 *  - allow for updating an attribute not defined by the model
 *      - not sure what the use case for this would be
 */
function createUpdate(__metadata={}, type) {
    assert(type, 'gell type is required');
    assert(type.TYPE, 'gell type must export TYPE string');

    const { name } = __metadata;

    /**
     * WIP: handle inherited attributes
     *  - would need to "compile" the model using gell-domain
     * 
     * @param {*} session_ 
     * @param {*} attribute 
     * @param {*} value 
     * @param {*} $txn 
     * @param {*} deps 
     * @returns 
     */
    async function doUpdate(session_, attribute, value, $txn, deps) {
        const def = type.model.attributes[attribute];
        assert(def, `no attribute (name=${attribute}) defined by model`);

        const { editable } = def;
        assert(editable, `attribute (name=${attribute}) is not editable`);

        return update.effect({
            params: { attribute, value },
            context: {
                session_,
                $txn
            },
            deps
        });
    }

    async function effect({ params={}, context={}, deps }) {
        const { logger } = deps.resolve('logger');

        logger.info(`executing effect (name="${name}")`);

        const { attribute, value } = params;
        const { session_ } = context;

        return doUpdate(session_, attribute, value, context.$txn, deps);
    }

    async function action({ params={}, context={}, deps }) {
        const { logger } = deps.resolve('logger');

        logger.info(`executing action (name="${name}")`);

        const { id, attribute, value } = params;

        const session_ = await lookup.effect({
            params: {
                key: {
                    type: type.TYPE,
                    id
                },
                failIfNotFound: true
            },
            context: {
                materialize: type.materialize
            },
            deps
        });

        return doUpdate(session_, attribute, value, context.$txn, deps);
    }

    return { __metadata, effect, action };
}

module.exports = { createUpdate };