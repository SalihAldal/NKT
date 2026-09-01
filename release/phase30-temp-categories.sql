INSERT INTO categories (
  id,
  slug,
  name,
  description,
  icon,
  "order",
  is_free,
  is_active,
  minimum_content_target,
  age_rating,
  supported_content_types,
  created_at,
  updated_at
)
VALUES
(
  'phase30-18free',
  'phase30-18free',
  'Phase30 18 Free',
  'phase30 temp free 18',
  '18',
  998,
  true,
  true,
  1,
  '18+',
  ARRAY['TRUTH']::text[],
  NOW(),
  NOW()
),
(
  'phase30-18premium',
  'phase30-18premium',
  'Phase30 18 Premium',
  'phase30 temp premium 18',
  '18',
  997,
  false,
  true,
  1,
  '18+',
  ARRAY['TRUTH']::text[],
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  is_free = EXCLUDED.is_free,
  is_active = EXCLUDED.is_active,
  age_rating = EXCLUDED.age_rating,
  updated_at = NOW();
