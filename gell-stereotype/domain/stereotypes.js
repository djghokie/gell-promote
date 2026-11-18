const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

/**
 * Registry of stereotypes (name => stereotype)
 *
 * A stereotype extends the "domain" concept: where a type defines a data structure, a stereotype also
 * defines the mutations (actions) and queries shared by the types that extend it (see docs/stereotype.md)
 *
 * A stereotype is a plain declarative object:
 *      {
 *          name: 'namespace',          // unique in the registry
 *          description: '...',
 *          model,                      // base gell-domain model extensions inherit
 *      }
 *
 * WIP: modeled on gell-discover's Types registry
 *  - stereotypes only carry metadata and a base model for now
 *  - actions, snapshots, queries, and configuration attributes come later
 */
class Stereotypes extends State {

    /**
     * @param {*} stereotype declarative stereotype definition; name is required
     */
    register(stereotype) {
        assert(_.isObject(stereotype), 'stereotype must be an object');

        const { name } = stereotype;
        assert(_.isString(name), 'stereotype name is required');

        // WIP: unclear if re-registering a stereotype should replace it or throw
        this.set(name, stereotype);
    }

    /**
     * WIP: this should probably be pushed up to a Directory implementation (same as Types.names)
     */
    names() {
        return this._internal.keys();
    }

}

module.exports = {
    Stereotypes,
}
