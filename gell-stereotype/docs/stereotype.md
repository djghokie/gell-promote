# `gell` stereotypes

## Concepts

* `stereotype`: extension of the "domain" concept
    * where as a `type` generally defines a data structure, a `stereotype` includes mutations (actions) and queries
* `extension`: series of types, queries, actions, etc that inherit from a `stereotype`
    * maybe this should be called `feature`

## Brainstorm

* might makes sense to put all of this code in `gell-domain`
    * altho much of the stereotype features are related to actions and snapshots
* `stereotype` extensions should be able to provide configuration
    * said another way, a `stereotype` should expose configuration attributes
* clearly, a declarative approach will be used to define an `extension`
* `stereotype` can define additional capabilities
    * search indexing
    * metric generation
    * etc

### Stereotypes

#### `item`

* base `stereotype`
* minimal attributes
    * `id`
    * `type`
    * `initiatedTs`
    * `updatedTs`
    * `parentId`?
        * this might be for `session`
* queries
    * `lookup`
    * `activity`

#### `session`

#### `asset`

#### `ledger`

### Possible Stereotypes

_haven't thought through this too much_

* `log`
    * timestamped "log entries"
    * i.e. a call log
    * capturing "activity" associated with some session
    * is this the same as session?
* `workflow`
    * transition events
    * querying by status