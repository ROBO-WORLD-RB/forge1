-- Seed Service Categories
INSERT INTO service_categories (name, slug, icon) VALUES
('Electrical', 'electrical', 'Zap'),
('Plumbing', 'plumbing', 'Droplet'),
('Carpentry', 'carpentry', 'Hammer'),
('Painting', 'painting', 'PaintBucket'),
('HVAC / AC', 'hvac', 'Wind'),
('Cleaning', 'cleaning', 'Sparkles'),
('Catering', 'catering', 'Utensils'),
('Event Decor', 'event-decor', 'Flower'),
('Event Planning', 'event-planning', 'Calendar'),
('Fashion Design', 'fashion-design', 'Scissors'),
('Photography', 'photography', 'Camera'),
('Makeup Artistry', 'makeup', 'Palette'),
('Auto Repair', 'auto-repair', 'Car'),
('Gardening', 'gardening', 'Leaf'),
('Interior Design', 'interior-design', 'Layout')
ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;
