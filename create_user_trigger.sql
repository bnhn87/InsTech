
CREATE OR REPLACE FUNCTION public.handle_new_confirmed_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.users (id, role, created_at, updated_at)
    VALUES (
      NEW.id, 
      'admin', 
      NEW.created_at, 
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_confirmed_user();

SELECT 'User creation trigger installed successfully!' as status;
