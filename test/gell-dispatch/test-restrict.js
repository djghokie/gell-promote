const assert = require('assert');

const restrict = require('../../gell-dispatch/util/restrict');

describe('restrict', function() {
    let module;

    beforeEach(function() {
        module = {
            __metadata: {
                name: 'unittest.event',
                triggers: {
                    effect: {},
                    action: {
                        params: { id: 'string' },
                        transaction: 'NEW'
                    }
                }
            },

            effect: z => 'effect',
            action: z => 'action'
        };
    })

    it('defines roles on action trigger', function() {
        const restricted = restrict(module, ['administrator']);

        assert.deepStrictEqual(restricted.__metadata.triggers.action, {
            params: { id: 'string' },
            transaction: 'NEW',
            roles: ['administrator']
        });
    })

    it('does not restrict effect trigger', function() {
        const restricted = restrict(module, ['administrator']);

        assert.deepStrictEqual(restricted.__metadata.triggers.effect, {});
    })

    it('does not add triggers the module does not implement', function() {
        const restricted = restrict(module, ['administrator']);

        assert(!restricted.__metadata.triggers.api);
    })

    it('defines trigger metadata if missing', function() {
        delete module.__metadata.triggers;

        const restricted = restrict(module, ['administrator']);

        assert.deepStrictEqual(restricted.__metadata.triggers.action, { roles: ['administrator'] });
    })

    it('keeps trigger functions', function() {
        const restricted = restrict(module, ['administrator']);

        assert.strictEqual(restricted.action, module.action);
        assert.strictEqual(restricted.effect, module.effect);
        assert.strictEqual(restricted.__metadata.name, 'unittest.event');
    })

    it('does not modify the original module', function() {
        restrict(module, ['administrator']);

        assert(!module.__metadata.triggers.action.roles);
    })

    it('requires roles', function() {
        assert.throws(z => restrict(module, []));
    })
})
