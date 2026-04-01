# SKILL: RLS Patterns Supabase
> Module ID: `security-rls` | Domaine: Sécurité / BDD | Stack: Supabase PostgreSQL

## Install
```sql
-- Activer RLS AVANT d'ajouter des policies (ordre obligatoire)
ALTER TABLE ma_table ENABLE ROW LEVEL SECURITY;
```

## Les 10 patterns RLS fondamentaux

### 1. User owns row (le plus courant)
```sql
CREATE POLICY "user_owns_row" ON projects
  FOR ALL USING (auth.uid() = user_id);
```

### 2. Org member — accès via table de jonction
```sql
CREATE POLICY "org_member_access" ON projects
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM org_members WHERE org_id = projects.org_id
    )
  );
```

### 3. Public read / auth write
```sql
CREATE POLICY "public_read" ON articles FOR SELECT USING (true);
CREATE POLICY "auth_insert" ON articles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "owner_update_delete" ON articles
  FOR UPDATE USING (auth.uid() = author_id);
```

### 4. Admin bypass — via JWT claim
```sql
CREATE POLICY "admin_full_access" ON projects
  FOR ALL USING (auth.jwt()->>'role' = 'admin');
```

### 5. Soft delete — exclure les rows supprimées
```sql
-- Ajouter cette condition dans TOUTES les SELECT policies
CREATE POLICY "hide_deleted" ON projects
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
```

### 6. Time-gated — accès limité dans le temps
```sql
CREATE POLICY "recent_only" ON audit_logs
  FOR SELECT USING (
    auth.uid() = user_id AND created_at > now() - interval '30 days'
  );
```

### 7. Status filter — masquer les statuts internes
```sql
CREATE POLICY "hide_archived" ON projects
  FOR SELECT USING (
    auth.uid() = user_id AND status != 'archived'
  );
```

### 8. Role hierarchy — rôles dans profiles
```sql
CREATE POLICY "manager_access" ON reports
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );
```

### 9. Shared resource — owner ou public
```sql
CREATE POLICY "owner_or_public" ON documents
  FOR SELECT USING (
    user_id = auth.uid() OR is_public = true
  );
```

### 10. Force ownership à la création (INSERT)
```sql
CREATE POLICY "force_ownership" ON projects
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- L'user ne peut pas créer un row en se faisant passer pour quelqu'un d'autre
```

## Pattern complet — table avec toutes les policies
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- SELECT : owner ou collaborateur
CREATE POLICY "select_policy" ON projects FOR SELECT
  USING (user_id = auth.uid() OR id IN (
    SELECT project_id FROM collaborators WHERE user_id = auth.uid()
  ));

-- INSERT : forcer l'ownership
CREATE POLICY "insert_policy" ON projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE : owner uniquement
CREATE POLICY "update_policy" ON projects FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- DELETE : owner uniquement
CREATE POLICY "delete_policy" ON projects FOR DELETE
  USING (user_id = auth.uid());
```

## Gotchas
- **`service_role` bypass RLS** — le client `service_role` ignore toutes les policies. Ne jamais l'exposer côté client ou dans le code front.
- **Policies séparées par opération** — une policy FOR ALL ne suffit pas si tu veux des règles différentes pour SELECT vs INSERT.
- **`WITH CHECK`** — obligatoire pour INSERT et UPDATE (condition sur les nouvelles valeurs). `USING` = condition sur les valeurs existantes.
- **Pas de RLS = table publique** — sans policy, une table avec RLS activé bloque TOUT. Ajouter au moins une policy SELECT.
- **Performance** — subqueries dans les policies (patterns 2, 8) peuvent être lentes. Indexer les colonnes de jointure.

## À NE PAS FAIRE
- Ne pas activer RLS après avoir ajouté des policies (les policies existantes peuvent bloquer)
- Ne pas utiliser `service_role` dans le client browser
- Ne pas oublier `WITH CHECK` sur les INSERT policies
- Ne pas faire confiance à un `user_id` passé depuis le client — toujours `auth.uid()` dans les policies
- Ne jamais désactiver RLS sur une table avec des données sensibles
