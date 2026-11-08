const assert = require('assert');
const _ = require('lodash');

const runtime = require('../../../../gell-runtime/mocha');

const bootstrap = require('../../bootstrap');

const ecosystem = require('../../../../gell-namespace/domain/ecosystem');

describe('applications snapshot', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    let store;
    let ecosystem_;

    beforeEach(function() {
        this.create = async function(name, relativeId) {
            return this.action({
                route: 'namespace.application.create#action',
                params: {
                    name,
                    relativeId
                },
                context: {
                    ecosystem_
                },
            });
        }

        this.applications = async function() {
            return this.snapshot({
                route: 'namespace.applications.active#api',
            });
        }
    })

    beforeEach(function() {
        ecosystem_ = ecosystem.materialize();

        store = this.deps.resolveSingle('store');
    })

    it('returns single application', async function() {
        await this.create('Unit Test Web', 'WEB');

        const applications_ = await this.applications();

        assert.strictEqual(1, applications_.length);
    })
})