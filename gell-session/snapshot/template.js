const assert = require('assert');
const _ = require('lodash');

const { createLookup } = require('../util/snapshot');

const template = require('../domain/template');

/**
 * NOTE: this might not work as expected
 *  - template.materialize returns a factory currently
 */
const __metadata = {
    name: 'template.lookup',
    description: '"template.lookup" event',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

module.exports = createLookup(__metadata, template);