CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

ALTER TABLE public.vehicles ADD COLUMN user_id uuid DEFAULT auth.uid();
ALTER TABLE public.inspections ADD COLUMN user_id uuid DEFAULT auth.uid();
ALTER TABLE public.categories ADD COLUMN user_id uuid DEFAULT auth.uid();
CREATE INDEX ON public.vehicles(user_id);
CREATE INDEX ON public.inspections(user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE first_user boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO first_user;
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  IF first_user THEN
    UPDATE public.vehicles SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE public.inspections SET user_id = NEW.id WHERE user_id IS NULL;
    UPDATE public.categories SET user_id = NEW.id WHERE user_id IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Public access vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Public access inspections" ON public.inspections;
DROP POLICY IF EXISTS "Public access categories" ON public.categories;
REVOKE ALL ON public.vehicles, public.inspections, public.categories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles, public.inspections, public.categories TO authenticated;

CREATE POLICY "Own vehicles" ON public.vehicles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own categories" ON public.categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own inspections" ON public.inspections FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.user_id = auth.uid()));