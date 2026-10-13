/*
 * The scripts of the job store. Each one runs atomically on the server and touches only the keys
 * it is given, which Dragonfly requires: the records hash, the sorted sets of one queue
 * (`waiting` by due instant, `running` by end of lease, `dead`), the finished set and the
 * idempotency keys. A record is JSON whose payload, checkpoint and progress are JSON texts the
 * scripts never open.
 */

/** KEYS: records, waiting, keys. ARGV: id, record, idempotency field or '', run at. Answers { id, duplicate }. */
export const ADD_JOB = `
if ARGV[3] ~= '' then
  local kept = redis.call('HGET', KEYS[3], ARGV[3])
  if kept then return {kept, 1} end
end
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return {ARGV[1], 0} end
local record = cjson.decode(ARGV[2])
record.seq = redis.call('HINCRBY', KEYS[1], '#sequence', 1)
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(record))
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[1])
if ARGV[3] ~= '' then redis.call('HSET', KEYS[3], ARGV[3], ARGV[1]) end
return {ARGV[1], 0}`;

/** KEYS: records, waiting, running. ARGV: now, limit, lease until. Answers the claimed records, earliest first. */
export const CLAIM_JOBS = `
local limit = tonumber(ARGV[2])
local records = {}
for _, set in ipairs({KEYS[2], KEYS[3]}) do
  for _, id in ipairs(redis.call('ZRANGEBYSCORE', set, '-inf', ARGV[1], 'LIMIT', 0, limit)) do
    local raw = redis.call('HGET', KEYS[1], id)
    if raw then table.insert(records, cjson.decode(raw)) end
  end
end
table.sort(records, function(a, b)
  if a.runAt == b.runAt then return a.seq < b.seq end
  return a.runAt < b.runAt
end)
local claimed = {}
for index = 1, math.min(#records, limit) do
  local record = records[index]
  record.status = 'running'
  record.attempts = record.attempts + 1
  record.leaseUntil = tonumber(ARGV[3])
  local raw = cjson.encode(record)
  redis.call('HSET', KEYS[1], record.id, raw)
  redis.call('ZREM', KEYS[2], record.id)
  redis.call('ZADD', KEYS[3], ARGV[3], record.id)
  table.insert(claimed, raw)
end
return claimed`;

/**
 * KEYS: records, waiting, running, dead, finished. ARGV: id, statuses allowed (space separated),
 * attempt or '', change. A change sets fields, removes those it sets to false, and adds
 * `attemptsDelta` to the attempts. Answers 1 when it applied, 0 otherwise.
 */
export const TRANSITION_JOB = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 0 end
local record = cjson.decode(raw)
if not string.find(' ' .. ARGV[2] .. ' ', ' ' .. record.status .. ' ', 1, true) then return 0 end
if ARGV[3] ~= '' and record.attempts ~= tonumber(ARGV[3]) then return 0 end
for field, value in pairs(cjson.decode(ARGV[4])) do
  if field == 'attemptsDelta' then record.attempts = record.attempts + value
  elseif value == false then record[field] = nil
  else record[field] = value end
end
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(record))
for index = 2, 5 do redis.call('ZREM', KEYS[index], ARGV[1]) end
if record.status == 'waiting' then redis.call('ZADD', KEYS[2], record.runAt, ARGV[1])
elseif record.status == 'running' then redis.call('ZADD', KEYS[3], record.leaseUntil, ARGV[1])
elseif record.status == 'dead' then redis.call('ZADD', KEYS[4], record.finishedAt, ARGV[1])
else redis.call('ZADD', KEYS[5], record.finishedAt, ARGV[1]) end
return 1`;

/** KEYS: records, finished, keys. ARGV: before. Answers how many records it dropped. */
export const PURGE_JOBS = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', '(' .. ARGV[1])
for _, id in ipairs(ids) do
  local raw = redis.call('HGET', KEYS[1], id)
  if raw then
    local record = cjson.decode(raw)
    if record.key then redis.call('HDEL', KEYS[3], record.key) end
    redis.call('HDEL', KEYS[1], id)
  end
  redis.call('ZREM', KEYS[2], id)
end
return #ids`;
