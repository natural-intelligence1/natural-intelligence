-- Stand-ins for the live structures migration 0064 depends on.
--
-- Reproduces the POST-0063 practitioners table (canonical taxonomy, the CHECK
-- vocabularies that 0064 reads), profiles, the agreement pair and the two
-- helper functions 0064 calls. 0064 is then executed against this, so the
-- tests exercise the real migration rather than a paraphrase of it.
--
-- auth.uid()/auth.role() are stubbed over GUCs. is_admin() and
-- practitioner_has_current_acceptance() are reproduced from the live
-- catalogue — the acceptance one verbatim in substance, because 0064's
-- agreement gate depends on exactly what it checks.

create schema if not exists auth;
create schema if not exists extensions;

-- PGlite has no pgcrypto, so extensions.digest is shimmed over md5, which is
-- in Postgres core. The property these tests exercise is "acceptance must
-- match the EXACT current agreement text" — md5 preserves that exactly. Live
-- uses sha256; only the algorithm differs, never the behaviour under test.
create or replace function extensions.digest(p_data text, p_algo text)
returns bytea language sql immutable as $$ select decode(md5(p_data), 'hex') $$;

create or replace function auth.uid() returns uuid language plpgsql stable as $$
begin
  return nullif(current_setting('test.auth_uid', true), '')::uuid;
exception when others then return null;
end $$;

create or replace function auth.role() returns text language plpgsql stable as $$
begin
  return coalesce(nullif(current_setting('test.auth_role', true), ''), 'authenticated');
end $$;

create table profiles (
  id           uuid primary key default gen_random_uuid(),
  full_name    text,
  role         text not null default 'user',
  is_test_data boolean not null default false
);

create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- Post-0063 practitioners: canonical taxonomy, live CHECK vocabularies.
create table practitioners (
  id                              uuid primary key default gen_random_uuid(),
  display_name                    text,
  category                        text,
  status                          text not null default 'pending_review',
  is_active                       boolean not null default false,
  credentials_verification_status text not null default 'unverified',
  indemnity_required              boolean not null default true,
  insurance_expiry                date,
  registration_number             text,
  registration_body               text,
  registration_status             text,
  dbs_status                      text,
  scope_status                    text not null default 'none',
  is_test_data                    boolean not null default false,
  constraint practitioners_category_check
    check (category = any (array['regulated_healthcare_professional'::text,
                                 'accredited_practitioner'::text,
                                 'ni_verified_practitioner'::text])),
  constraint practitioners_status_check
    check (status = any (array['pending_review','approved','active','suspended','archived'])),
  constraint practitioners_dbs_status_check
    check (dbs_status = any (array['required','not_required','pending','clear','flagged'])),
  constraint practitioners_scope_status_check
    check (scope_status = any (array['none','submitted','approved','revoked']))
);

create table practitioner_agreements (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  version    text not null,
  title      text not null default 't',
  body       text not null default 'b',
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table practitioner_agreement_acceptances (
  id                 uuid primary key default gen_random_uuid(),
  practitioner_id    uuid not null references practitioners(id) on delete cascade,
  agreement_id       uuid not null references practitioner_agreements(id),
  agreement_version  text not null,
  accepted_at        timestamptz not null default now(),
  accepted_text_hash text not null
);

-- Verbatim in substance from the live catalogue: acceptance must match the
-- current agreement for the practitioner's category by id, version AND a
-- sha256 of its exact text. 0064's agreement gate depends on this precision.
create or replace function public.practitioner_has_current_acceptance(p_practitioner_id uuid)
returns boolean language sql stable as $$
  SELECT EXISTS (
    SELECT 1
      FROM public.practitioner_agreements a
      JOIN public.practitioners p
        ON p.id = p_practitioner_id AND p.category = a.category
      JOIN public.practitioner_agreement_acceptances acc
        ON acc.practitioner_id    = p_practitioner_id
       AND acc.agreement_id       = a.id
       AND acc.agreement_version  = a.version
       AND acc.accepted_text_hash = encode(extensions.digest(a.body, 'sha256'), 'hex')
     WHERE a.is_current
  );
$$;
