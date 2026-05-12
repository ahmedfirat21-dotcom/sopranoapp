SELECT id, username, display_name, avatar_url, active_frame
FROM profiles
WHERE username='44burakdeniz' OR display_name ILIKE '%Burak%'
LIMIT 5;
