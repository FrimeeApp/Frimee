-- Mark all stale llamadas (ringing/active for more than 2 hours) as missed/ended
UPDATE llamadas
SET estado = CASE WHEN estado = 'ringing' THEN 'missed' ELSE 'ended' END,
    finalizada_at = now()
WHERE estado IN ('ringing', 'active')
  AND iniciada_at < now() - interval '2 hours';
