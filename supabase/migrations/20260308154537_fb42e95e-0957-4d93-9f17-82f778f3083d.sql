
-- Create storage bucket for generated visuals
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-visuals', 'generated-visuals', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload visuals"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-visuals');

-- Allow public read access
CREATE POLICY "Anyone can view generated visuals"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'generated-visuals');

-- Allow users to delete their own visuals
CREATE POLICY "Users can delete own visuals"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-visuals' AND (storage.foldername(name))[1] = auth.uid()::text);
