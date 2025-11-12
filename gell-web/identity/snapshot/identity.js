const assert = require('assert');
const _ = require('lodash');

const identity = require('gell-web/identity/domain/identity');

const { createLookup } = require('../../../gell-session/util/snapshot');

const __metadata = {
    name: 'web.identity.lookup',
    description: 'fetches a WEB#IDENTITY by id',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

module.exports = createLookup(__metadata, identity);