const { State } = require('gell');

/**
 * WIP: this needs to be combined with gell-visibility error
 */
class ErrorState extends State {

    class = Error;

    /**
     * Throws an Error with snapshot attribute values
     * 
     * WIP: could use "cause" property on error
     */
    throw(actor) {
        const e = new this.class();

        Object.assign(e, this.snapshot(actor));

        throw e;
    }

}

module.exports = ErrorState;