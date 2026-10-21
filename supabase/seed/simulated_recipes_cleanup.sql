-- Removes the simulated recipe activity (ratings + favorites cascade). Then delete the seed/ folder in the recipe-images bucket.
delete from public.recipes where image_path like 'seed/%';
