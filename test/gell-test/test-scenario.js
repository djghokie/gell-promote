const assert = require('assert');
const _ = require('lodash');

const runScenario = require('../../gell-test/scenario');

describe('scenario execution', function() {
    beforeEach(function() {
    })

    describe('base cases', function() {
        beforeEach(function() {
        })
    
        it('empty scenario', async function() {
            const result = await runScenario(function*() {}());

            assert(_.isUndefined(result));
        })

        it('non yielding sync scenario', async function() {
            const s = function*() {
                return 'gello!';
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })

        it('non yielding async scenario', async function() {
            const s = async function*() {
                return 'gello!';
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })

        it('throwing scenario', async function() {
            const s = async function*() {
                throw new Error('wft!');
            };

            return assert.rejects(z => runScenario(s()));
        })

        it('returning scenario', async function() {
            const s = async function*() {
                try {
                } finally {
                    return 'gello!';
                }
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })

        /**
         * NOTE: the exception gets swallowed here; so probably not how you'd want to write a scenario
         */
        it('catch/finally scenario', async function() {
            const s = async function*() {
                try {
                    throw new Error('wft!');
                } catch(e) {
                    throw e;
                } finally {
                    return 'gello!';
                }
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })
    })

    describe('simple scenarios', function() {
        beforeEach(function() {
        })
    
        it('yielding sync', async function() {
            const s = function*() {
                yield 'gello!';
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })

        it('yielding/returing sync', async function() {
            const s = function*() {
                yield 'foobar';

                return 'gello!';
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })

        it('yielding async', async function() {
            const s = async function*() {
                yield 'gello!';
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })

        it('yielding/returing async', async function() {
            const s = async function*() {
                yield 'foobar';

                return 'gello!';
            };

            const result = await runScenario(s());

            assert.strictEqual('gello!', result);
        })
    })
})