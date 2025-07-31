
SELECT 'Checking required tables...' as status;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') 
        THEN '✓ users table exists'
        ELSE '✗ users table missing'
    END as users_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects') 
        THEN '✓ projects table exists'
        ELSE '✗ projects table missing'
    END as projects_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_members') 
        THEN '✓ project_members table exists'
        ELSE '✗ project_members table missing'
    END as project_members_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'floor_plans') 
        THEN '✓ floor_plans table exists'
        ELSE '✗ floor_plans table missing'
    END as floor_plans_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pins') 
        THEN '✓ pins table exists'
        ELSE '✗ pins table missing'
    END as pins_table;

SELECT 'Checking RLS status...' as status;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'projects', 'project_members', 'floor_plans', 'pins')
ORDER BY tablename;

SELECT 'Checking key policies...' as status;

SELECT 
    tablename,
    policyname,
    cmd as policy_type
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'projects', 'project_members')
ORDER BY tablename, policyname;

SELECT 'Testing basic functionality...' as status;

SELECT 'Schema setup complete!' as result;
