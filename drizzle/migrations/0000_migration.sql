CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  item text,
  location text,
  confidence numeric,
  reason text,
  evidence text,
  status text DEFAULT 'new' CHECK (status IN ('new','reviewed','false_alarm'))
);
GRANT SELECT, INSERT, UPDATE ON public.incidents TO anon, authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo read" ON public.incidents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "demo insert" ON public.incidents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "demo update" ON public.incidents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;