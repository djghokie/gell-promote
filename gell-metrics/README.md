# gell-metrics

* defines abstraction for collecting `gell-session` based metrics
* originally developed as part of Entheon Institute implementation
* this is not a `gell` package yet
* could be renamed `gell-analytics`

## Concepts

* `metric`: measurement of some system activity
* triggering event
    * application event that generates metrics
        * for example, a `session` ending
* metric event
    * defines what happened when

## Brainstorm

* does this really belong in its own package?
    * or just part of `gell-session`
* metric collection is really just processing of an event stream
* events can be sourced in a variety of different ways
    * analysis of image transitions (Dynamodb streams)
	* explcit firing of events by event handlers
	* re-creation of events through streaming persisted session state
* package features/capabilities
    * metric re-loading jobs
	* metric reporting
	* event re-creation from various sources
	* unit testing
	* "dry run" features
* reporting features
    * is this reporting on already collected metrics?
	* or is this re-creation and exporting of metric events?

## Migration

* ...

## v2

### Brainstorm

* could `session` table be used instead?
    * unclear what the real advantage is here
        * re-use of queries?
        * one less table to manage
    * `startTs` and `endTs` could be used to potentially deal with time zone issues
    * would not limit subject/timeperiod pair to just a single item
    * may be able to associate metrics to a "parent" item easier
    * required `session` attributes
        * `type`
        * `id`
    * probably wouldn't need `subjectType` attribute anymore
        * could be soemthing like `MEETING#METRIC`
        * or potentially use some other way to designate that it is a metric
            * something like `TRANSPORTATION#DRIVER^`
        * would allow for a local secondary index
            * `timePeriod` is the sort key
            * reuse queries
    * metric modeling would follow standard `gell` type modeling
        * potentially additional attributes to declaratively define how metrics are collected
        * or, `metrics` becomes part of the type model definition
            * metrics type could be derived
    * this probably means that metrics should extend `schedulable` (`gell-schedule`)
        * capture additional attributes
            * `startTs`
            * `endTs`
            * `timeZone`
* introduce `event` domain?
    * probably a representation of this already (`gell-session`?)
    * combine this with metric event?
* is there a time period hierarchy that would allow for more efficient updates?
    * updating DAY time period metric would trigger updating WEEK time period

### Improvements

* definte `metric` domain
* batch writes of metric items
* some concept of time period name
    - i.e "February" or "Tuesday"
    - should be indexed or query-able
* each "application" event (i.e. session ending) should generate one or more "metric" events
    * stream handler can easily deal with new or updated metrics
    * allows for custom analytics queries
        - for example, query the number of times something happened within a custom date range
        - not restricted to pre-defined time periods
* have time period hierarchy for metrics
    * make sure more granular metric is commited first
* context information only updates when metrics are updated