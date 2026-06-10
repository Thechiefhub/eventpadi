-- Fix missing ownership checks on storage bucket INSERT policies
-- Certificates bucket: restrict uploads to user-owned folder paths
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;

CREATE POLICY "Authenticated users can upload certificates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'certificates'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Generated visuals bucket: restrict uploads to user-owned folder paths
DROP POLICY IF EXISTS "Authenticated users can upload visuals" ON storage.objects;

CREATE POLICY "Authenticated users can upload visuals"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generated-visuals'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );