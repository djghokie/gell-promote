# Metric Persistence

## Concepts

## v1

_first implemented by EI_

### General Notes

* metrics aggregated on the fly using Dynamodb streams
* separate Dynamodb table used to store metrics
* identified issues
    * providing "context" when displaying metrics
        * this refers to identifying information such as a `label` or `title` property
        * this data must be replicated to all associated metrics when it changes
            * could be a lot of updates
            * is this really an issue?  just choose context that does not change often
    * must recreate event triggering metric generation
        * sometimes difficult to do from an item image
            * images are current state of an item
        * extra work required instead of just persisting the triggering event
        * extra modeling in each domain
    * no good way to do more advanced analytics
        * for airport report, I need to know
            * number of trips in a month
            * only pickups
            * by vehicle
* advantages of current table design
    * can overwrite easy as metrics are regenerated
        * `subject`/`timeperiod` key does not change when regenerating metrics

### Metric Table

* multiple metric values stored with each item

* `subject`
    * primary partition key
    * what the metrics apply to
        * i.e. a `user`, `vehicle`, etc
* `timePeriod`
    * primary sort key
    * string representing a time period
        * i.e. month, day, hour, etc
    * _potential issue with time zones_
* `subjectType`
    * secondary partition key
    * `type` of the `subject`
    * `timePeriod` is the secondary sort key

### Metric Generation

* triggered by Dynamodb stream events
* triggering event is recreated by looking at old and new images
* from triggering event, one or more metric events are generated
* metric event generates one or more metric items
