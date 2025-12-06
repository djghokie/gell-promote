const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');
const runtime = require('gell-runtime/mocha');

const { protectedPage } = require('../../gell-auth/page');

/**
 * WIP: to test this id need to mock the request and response
 */
describe.skip('page auth', function() {
    let context;
    
    before(runtime.beforeAll);

    beforeEach(function() {
        context = {
            req: {},
            res: {}
        }
    })

    describe('protected page', function() {
        let $page;

        beforeEach(function() {
            const authOptions = {
                session: {
                    strategy: 'jwt',
                },
            };

            [$page] = init(protectedPage(['admin'], authOptions, null, {}));
        })
    
        it('works', async function() {
            const res = await $page.next(context).value;

            assert(res);
        })
    })
})
