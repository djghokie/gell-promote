const Store = require('gell-aws-dynamodb/mock/store');
const queryWrapper = require('gell-aws-dynamodb/query-wrapper');
const operationWrapper = require('gell-aws-dynamodb/operation-wrapper');
module.exports = class extends Store {

    configureQueries(...queries) {
        Object.assign(this.namedQueries, queryWrapper.ut(...queries));
    }

    configureOperations(...operations) {
        Object.assign(this.writeOptions.namedOperations, operationWrapper.ut(...operations));
    }

}
