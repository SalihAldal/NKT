SELECT r.id AS room_id,
       r.code,
       p.id AS player_id,
       p.user_id,
       p.display_name,
       p.is_host,
       p.is_ready,
       p.session_token
FROM rooms r
JOIN room_players p ON p.room_id = r.id
WHERE r.code = 'MHUDRF'
  AND p.left_at IS NULL
ORDER BY p.created_at;
