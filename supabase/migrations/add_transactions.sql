CREATE TABLE IF NOT EXISTS public.transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  date        date NOT NULL,
  amount      integer NOT NULL,
  type        text NOT NULL CHECK (type IN ('income', 'expense')),
  description text NOT NULL DEFAULT '',
  category    text NOT NULL DEFAULT '',
  account     text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own transactions" ON public.transactions
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
