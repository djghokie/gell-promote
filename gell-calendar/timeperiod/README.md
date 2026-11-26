# gell-calendar/timeperiod

Custom (defined) time periods, e.g. SEASON or PAY_PERIOD. Unlike the gell-calendar standard time periods
(HOUR, DAY, WEEK, ...), a custom `CALENDAR#TIMEPERIOD` can't compute its instances from a date: its instances are
`CALENDAR#TIMEPERIOD#INSTANCE` children (parentId) with dates someone enters, and gaps between instances are allowed.

- `domain/timeperiod` - `CALENDAR#TIMEPERIOD`: `label` (UPPERCASE, `normalizeLabel`), `description`; `STANDARD_LABELS` lists the reserved labels
- `domain/instance` - `CALENDAR#TIMEPERIOD#INSTANCE`: `name`, `startTs`, `endTs` (exclusive), `timeZone` (IANA); `overlaps`, `isTimeZone`
- `event/save` - action `calendar.timeperiod.save`: creates (no id) or updates a TIMEPERIOD; rejects standard and duplicate labels
- `instance/event/save` - action `calendar.timeperiod.instance.save`: creates or updates an instance; instances of a TIMEPERIOD may not overlap
- `snapshot/timeperiods` - `calendar.timeperiods`: the TIMEPERIODs, sorted by label
- `snapshot/instances` - `calendar.timeperiod.instances`: the instances of a TIMEPERIOD, sorted by startTs

Using it in an application:

- discover the modules: add `gell-promote/gell-calendar/timeperiod` to the registry discovery paths
  (webpack `require.context(..., true, /(event|snapshot)\/.+\.js$/)` and the test bootstrap)
- register both types on the `types` registry, e.g. scoped to the TENANT:
  `types.register(timeperiod.TYPE, timeperiod.model, 'TENANT')` and `types.register(instance.TYPE, instance.model, 'TENANT')`
  (handlers fall back to the raw TYPE when there is no `types` dependency)
- the store needs the gell-session named queries `sessions.activity.type` and `session.children`
- no roles are defined; restrict the actions/snapshots in the application if needed
