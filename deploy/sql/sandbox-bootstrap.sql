DO $$
BEGIN
  EXECUTE format('ALTER ROLE %I CREATEDB CREATEROLE', current_user);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'could not ALTER ROLE %: %', current_user, SQLERRM;
END
$$;

DO $$
BEGIN
  EXECUTE format('ALTER ROLE %I SET createrole_self_grant = %L', current_user, 'set, inherit');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'could not set createrole_self_grant for %: %', current_user, SQLERRM;
END
$$;

DO $$
DECLARE db text;
BEGIN
  FOREACH db IN ARRAY ARRAY['postgres', 'template1'] LOOP
    BEGIN
      EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', db);
    EXCEPTION WHEN insufficient_privilege OR undefined_object THEN
      RAISE WARNING 'could not REVOKE CONNECT on %: %', db, SQLERRM;
    END;
  END LOOP;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE postgres TO %I', current_user);
  GRANT CONNECT ON DATABASE postgres TO cloudsqlsuperuser;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'could not GRANT CONNECT to %: %', current_user, SQLERRM;
END
$$;

SELECT current_user AS provisioner,
       (SELECT rolcreatedb   FROM pg_roles WHERE rolname = current_user) AS can_createdb,
       (SELECT rolcreaterole FROM pg_roles WHERE rolname = current_user) AS can_createrole,
       (SELECT rolsuper      FROM pg_roles WHERE rolname = current_user) AS is_superuser,
       EXISTS (SELECT 1 FROM pg_database d, aclexplode(coalesce(d.datacl, acldefault('d', d.datdba))) a
               WHERE d.datname = 'postgres' AND a.grantee = 0 AND a.privilege_type = 'CONNECT') AS public_can_connect_postgres,
       version() AS pg_version;
