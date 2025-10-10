const assert = require('assert');
const _ = require('lodash');

const build = require('../../gell-dispatch/util/chain');

describe('function chain', function() {

    describe('no functions', function() {
        it('no args returns undefined', function() {
            const chain = build();

            const result = chain();

            assert(_.isUndefined(result));
        })

        it('single arg returns undefined', function() {
            const chain = build();

            const result = chain('gello!');

            assert(_.isUndefined(result));
        })
    })

    describe('single function', function() {
        let chain;

        describe('noop function', function() {
            beforeEach(function() {
                chain = build(z => {});
            })
        
            it('no args returns undefined', function() {
                const result = chain();

                assert(_.isUndefined(result));
            })

            it('single arg returns undefined', function() {
                const result = chain('gello!');

                assert(_.isUndefined(result));
            })
        })

        describe('simple function', function() {
            beforeEach(function() {
                chain = build(z => 'world!');
            })
        
            it('no args returns last result', function() {
                const result = chain();

                assert.strictEqual(result, 'world!');
            })

            it('single arg returns last result', function() {
                const result = chain('gello!');

                assert.strictEqual(result, 'world!');
            })
        })
    })

    describe('two functions', function() {
        let chain, firstExecuted;

        describe('noop function', function() {
            beforeEach(function() {
                chain = build(
                    z => { firstExecuted = true },
                    z => {}
                );
            })

            it('chain invoked', async function() {
                chain();

                assert(firstExecuted);
            })
        
            it('no args returns undefined', function() {
                const result = chain();

                assert(_.isUndefined(result));
            })

            it('single arg returns undefined', function() {
                const result = chain('gello!');

                assert(_.isUndefined(result));
            })
        })

        describe('simple function', function() {
            beforeEach(function() {
                chain = build(
                    (z, resume) => { firstExecuted = true; return resume(z); },
                    z => 'world!'
                );
            })
        
            it('chain invoked', async function() {
                chain();

                assert(firstExecuted);
            })
        
            it('no args returns last result', function() {
                const result = chain();

                assert.strictEqual(result, 'world!');
            })

            it('single arg returns last result', function() {
                const result = chain('gello!');

                assert.strictEqual(result, 'world!');
            })
        })
    })

    it('building call chain', async function() {
        var result = "";

        async function e(arg) {
            // console.debug('e', arg);

            return arg + "4";
        }
        async function one(arg, resume) {
            // console.debug('one-before', arg);

            const a = arg + '1';

            const b = await resume(a);
            
            // console.debug('one-after', b);

            return b + "6";
        }
        function two(arg, resume) {
            // console.debug('two-before', arg);

            result += "2";

            return resume(arg + '2');
        }
        async function three(arg, resume) {
            const a = await resume(arg);

            return a + "5";
        }

        assert.strictEqual(await build(e)('0'), '04');
        // assert.strictEqual(await build(one)('0'), '016');
        assert.strictEqual(await build(two, e)('0'), '024');
        assert.strictEqual(await build(one, e)('0'), '0146');
        assert.strictEqual(await build(one, two, e)('0'), '01246');
        assert.strictEqual(await build(one, two, three, e)('0'), '012456');
    })

})