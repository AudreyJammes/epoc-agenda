-- Étape 1 : Ajouter la colonne user_id
ALTER TABLE agenda_evenements
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Étape 2 : Remplir user_id pour tous les événements existants
UPDATE agenda_evenements
  SET user_id = 'a34902f7-8f9e-4507-82f8-2d0bb40f5cb3'
  WHERE user_id IS NULL;

-- Étape 3 : Mettre à jour les politiques RLS

DROP POLICY IF EXISTS "Lecture agenda — utilisateur authentifié" ON agenda_evenements;
DROP POLICY IF EXISTS "Insertion agenda — utilisateur authentifié" ON agenda_evenements;
DROP POLICY IF EXISTS "Modification agenda — utilisateur authentifié" ON agenda_evenements;
DROP POLICY IF EXISTS "Suppression agenda — utilisateur authentifié" ON agenda_evenements;

CREATE POLICY "Lecture agenda — utilisateur authentifié"
  ON agenda_evenements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Insertion agenda — utilisateur authentifié"
  ON agenda_evenements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Modification agenda — utilisateur authentifié"
  ON agenda_evenements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Suppression agenda — utilisateur authentifié"
  ON agenda_evenements FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
