const assert = require('assert');
const _ = require('lodash');

const project = require('gell/state/project');
const lookup = require('gell-session/snapshot/lookup');

/**
 * WIP: idea here is that we have a standard approach to basic session lookups
 *  - trying to cut down on boilerplate code
 *  - based on a type (domain)
 *  - suppose this could be a class/instance
 *  - this could also be solved by have additional context attributes to lookup
 *      - type attribute
 *      - could also support both approaches
 *  - could further extend this by automatically generating lookup snapshots
 *      - would need some sort of type registration process
 *      - automatically add to $bus
 *  - for now, target to gell-session/util folder
 *      - this may be a new gell package
 *      - not sure "util" is the right folder
 * 
 * WIP: additional features to support
 *  - non array projections
 *      - gell-domain model?
 *  - materialize context attribute
 *      - if true, use type materialize
 *      - if false, return image from store
 *  - snapshot context attribute
 *      - if true, take snapshot
 *      - if string, take snapshot as actor
 */
function createLookup(__metadata={}, type) {
    assert(type, 'gell type is required');
    assert(type.TYPE, 'gell type must export TYPE string');

    const { name } = __metadata;

    async function doLookup(id, failIfNotFound=true, projection, deps) {
        const type_ = await lookup.effect({
            params: {
                key: {
                    type: type.TYPE,
                    id
                },
                failIfNotFound
            },
            context: {
                materialize: type.materialize
            },
            deps
        });

        if (projection) {
            if (_.isArray(projection)) return project.subset(type_, ...projection);
            else throw new Error('non array projections not yet supported');
        }

        return type_;
    }

    async function effect({ params={}, context={}, deps }) {
        const { logger } = deps.resolve('logger');

        logger.info(`executing effect (name="${name}")`);

        const { id, failIfNotFound } = params;
        const { projection } = context;

        return doLookup(id, failIfNotFound, projection, deps);
    }

    async function api({ params={}, deps }) {
        const { logger } = deps.resolve('logger');

        logger.info(`executing api (name="${name}")`);

        const { id } = params;

        return doLookup(id, true, null, deps);
    }

    return { __metadata, effect, api };
}

module.exports = { createLookup };