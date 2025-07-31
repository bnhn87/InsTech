
grant select, insert, update, delete on all tables in schema public to authenticated;

grant usage on all sequences in schema public to authenticated;

grant execute on all functions in schema public to authenticated;

SELECT 'Permissions granted successfully!' as status;

SELECT grantee, table_name, privilege_type 
FROM information_schema.table_privileges 
WHERE grantee = 'authenticated' AND table_schema = 'public'
ORDER BY table_name, privilege_type;
