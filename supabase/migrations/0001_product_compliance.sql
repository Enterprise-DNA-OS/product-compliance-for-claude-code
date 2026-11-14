-- Product Compliance for Claude Code: the schema.
-- Suppliers, parts, products and their bills of materials; the rules each market applies;
-- what every supplier has declared about every part; conflict minerals reporting templates;
-- the requests out to suppliers and in from customers; certificates issued; and a trail of every change.
-- Plain Postgres. Runs on any Postgres 14+ and on PGlite.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create table settings (
  key text primary key,
  value text not null,
  note text,
  updated_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact_name text,
  contact_email text,
  country text,
  supplies_3tg boolean not null default false, -- parts contain tin, tantalum, tungsten or gold
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table parts (
  id uuid primary key default gen_random_uuid(),
  part_no text not null unique,
  description text not null,
  supplier_id uuid references suppliers(id),
  mfr_part_no text,
  category text,
  mass_g numeric(12,3) check (mass_g is null or mass_g >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  markets text[] not null default '{}',   -- EU, UK, US, US-CA, AU, NZ ...
  scip_ref text,                          -- ECHA SCIP notification number, when one is needed
  owner text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bom (
  product_id uuid not null references products(id) on delete cascade,
  part_id uuid not null references parts(id),
  qty numeric(12,3) not null default 1 check (qty > 0),
  primary key (product_id, part_id)
);

-- The rules. scope 'part' is answered by a part declaration; scope 'supplier' by a conflict minerals template.
create table regulations (
  code text primary key,
  name text not null,
  markets text[] not null,
  scope text not null default 'part' check (scope in ('part','supplier')),
  validity_months int check (validity_months is null or validity_months > 0),
  follows_candidate_list boolean not null default false,
  source text not null,
  active boolean not null default true
);

create table substances (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cas text,
  rohs_limit_ppm int,           -- Annex II maximum concentration in a homogeneous material
  svhc_added date,              -- date added to the REACH Candidate List
  prop65 boolean not null default false,
  source text not null
);

create table declarations (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references parts(id),
  regulation text not null references regulations(code),
  status text not null check (status in ('compliant','compliant_exemption','non_compliant','contains_listed')),
  exemption text,
  exemption_expires date,
  received_on date not null,
  valid_until date,
  document_ref text,
  source text not null default 'supplier' check (source in ('supplier','lab_test','import','own_assessment')),
  actor text not null,
  created_at timestamptz not null default now(),
  check (status <> 'compliant_exemption' or exemption is not null)
);
create index declarations_part_reg on declarations(part_id, regulation, received_on desc);

create table declaration_substances (
  id uuid primary key default gen_random_uuid(),
  declaration_id uuid not null references declarations(id) on delete cascade,
  substance_id uuid not null references substances(id),
  concentration_ppm numeric(12,1) check (concentration_ppm is null or concentration_ppm >= 0), -- null: supplier said it is present but gave no figure
  location text,
  unique (declaration_id, substance_id)
);

create table cmrts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  template_version text,
  received_on date not null,
  scope text not null default 'company' check (scope in ('company','product','user_defined')),
  smelters_reported int not null default 0 check (smelters_reported >= 0),
  smelters_conformant int not null default 0 check (smelters_conformant >= 0),
  smelters_not_conformant int not null default 0 check (smelters_not_conformant >= 0),
  document_ref text,
  actor text not null,
  created_at timestamptz not null default now(),
  check (smelters_conformant + smelters_not_conformant <= smelters_reported)
);

create table supplier_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  regulation text not null references regulations(code),
  part_nos text[] not null default '{}',
  sent_on date not null,
  due_on date not null,
  reminders int not null default 0,
  last_reminder date,
  status text not null default 'open' check (status in ('open','answered','escalated','dropped')),
  outcome text,
  actor text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customer_requests (
  id uuid primary key default gen_random_uuid(),
  customer text not null,
  product_id uuid not null references products(id),
  regulation text not null references regulations(code),
  received_on date not null,
  due_on date not null,
  status text not null default 'open' check (status in ('open','answered','dropped')),
  outcome text,
  actor text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  regulation text not null references regulations(code),
  issued_to text not null,
  issued_on date not null default current_date,
  status_at_issue text not null,
  substances text,
  customer_request_id uuid references customer_requests(id),
  actor text not null,
  created_at timestamptz not null default now()
);

create table activity (
  id bigserial primary key,
  entity text not null,
  ref text,
  action text not null,
  actor text not null,
  before_data jsonb,
  after_data jsonb,
  evidence text,
  created_at timestamptz not null default now()
);

create table imports (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  file_sha256 text not null,
  rows_read int not null,
  actor text not null,
  summary jsonb,
  created_at timestamptz not null default now()
);

create trigger suppliers_touch before update on suppliers for each row execute function touch_updated_at();
create trigger parts_touch before update on parts for each row execute function touch_updated_at();
create trigger products_touch before update on products for each row execute function touch_updated_at();
create trigger supplier_requests_touch before update on supplier_requests for each row execute function touch_updated_at();
create trigger customer_requests_touch before update on customer_requests for each row execute function touch_updated_at();
create trigger settings_touch before update on settings for each row execute function touch_updated_at();

-- ------------------------------------------------------------------ views

-- The latest declaration for every part and part-scoped rule, and what state it is in today.
create view v_part_rule as
with latest as (
  select distinct on (d.part_id, d.regulation) d.*
  from declarations d
  order by d.part_id, d.regulation, d.received_on desc, d.created_at desc
), cl as (
  select nullif(value,'')::date as updated from settings where key = 'candidate_list_updated'
)
select p.id as part_id, p.part_no, p.description, s.code as supplier, s.id as supplier_id,
  r.code as regulation, l.id as declaration_id, l.status as declared, l.exemption, l.exemption_expires,
  l.received_on, l.valid_until, l.document_ref,
  case
    when l.id is null then 'missing'
    when l.valid_until is not null and l.valid_until < current_date then 'expired'
    when r.follows_candidate_list and (select updated from cl) is not null and l.received_on < (select updated from cl) then 'stale'
    else l.status
  end as state
from parts p
cross join regulations r
left join suppliers s on s.id = p.supplier_id
left join latest l on l.part_id = p.id and l.regulation = r.code
where p.active and r.active and r.scope = 'part'
  and exists (
    select 1 from bom b join products pr on pr.id = b.product_id
    where b.part_id = p.id and pr.active and pr.markets && r.markets
  );

-- Conflict minerals: the latest template from every supplier whose parts carry 3TG.
create view v_supplier_cmrt as
with latest as (
  select distinct on (c.supplier_id) c.* from cmrts c order by c.supplier_id, c.received_on desc, c.created_at desc
), rule as (select * from regulations where code = 'CONFLICT-MINERALS')
select s.id as supplier_id, s.code as supplier, s.name, l.template_version, l.received_on,
  (l.received_on + make_interval(months => coalesce((select validity_months from rule), 12)))::date as valid_until,
  l.smelters_reported, l.smelters_conformant, l.smelters_not_conformant,
  case
    when l.id is null then 'missing'
    when l.received_on + make_interval(months => coalesce((select validity_months from rule), 12)) < current_date then 'expired'
    when l.smelters_not_conformant > 0 then 'not_conformant_smelters'
    else 'compliant'
  end as state
from suppliers s
left join latest l on l.supplier_id = s.id
where s.active and s.supplies_3tg;

-- Every product against every rule that applies in its markets, rolled up from its parts.
create view v_product_rule as
with part_rows as (
  select b.product_id, pr.regulation, pr.part_no, pr.state
  from bom b join v_part_rule pr on pr.part_id = b.part_id
  union all
  select b.product_id, 'CONFLICT-MINERALS', p.part_no, c.state
  from bom b join parts p on p.id = b.part_id join v_supplier_cmrt c on c.supplier_id = p.supplier_id
  where p.active
)
select pd.id as product_id, pd.code as product, pd.name, r.code as regulation, pd.markets,
  count(x.part_no)::int as parts,
  count(*) filter (where x.state in ('missing','expired','stale'))::int as unknown_parts,
  count(*) filter (where x.state in ('non_compliant','not_conformant_smelters'))::int as failing_parts,
  count(*) filter (where x.state = 'contains_listed')::int as listed_parts,
  count(*) filter (where x.state = 'compliant_exemption')::int as exemption_parts,
  case
    when count(*) filter (where x.state in ('non_compliant','not_conformant_smelters')) > 0 then 'non_compliant'
    when count(*) filter (where x.state in ('missing','expired','stale')) > 0 then 'unknown'
    when count(*) filter (where x.state = 'contains_listed') > 0 then 'contains_listed'
    when count(*) filter (where x.state = 'compliant_exemption') > 0 then 'compliant_exemption'
    when count(x.part_no) = 0 then 'no_parts'
    else 'compliant'
  end as status
from products pd
join regulations r on r.active and pd.markets && r.markets
left join part_rows x on x.product_id = pd.id and x.regulation = r.code
where pd.active
  and (r.scope = 'part' or exists (
    select 1 from bom b join parts p on p.id = b.part_id join suppliers s on s.id = p.supplier_id
    where b.product_id = pd.id and s.supplies_3tg))
group by pd.id, pd.code, pd.name, r.code, pd.markets;

-- Candidate List substances above 0.1% weight by weight in any part of an active product.
create view v_svhc as
select pd.code as product, pd.name as product_name, pd.markets, pd.scip_ref, p.part_no, s.name as substance, s.cas,
  ds.concentration_ppm, ds.location, pr.received_on
from v_part_rule pr
join declaration_substances ds on ds.declaration_id = pr.declaration_id
join substances s on s.id = ds.substance_id and s.svhc_added is not null
join bom b on b.part_id = pr.part_id
join products pd on pd.id = b.product_id and pd.active
join parts p on p.id = pr.part_id
where pr.regulation = 'REACH-SVHC' and pr.state in ('contains_listed','stale','expired') and (ds.concentration_ppm is null or ds.concentration_ppm > 1000);

create view v_exemptions as
select pr.part_no, pr.description, pr.supplier, pr.regulation, pr.exemption, pr.exemption_expires,
  (pr.exemption_expires - current_date) as days_left,
  (select string_agg(distinct pd.code, ', ') from bom b join products pd on pd.id = b.product_id and pd.active where b.part_id = pr.part_id) as used_in
from v_part_rule pr
where pr.declared = 'compliant_exemption';

create view v_open_supplier_requests as
select r.id, s.code as supplier, s.name, s.contact_email, r.regulation, r.part_nos, r.sent_on, r.due_on,
  r.reminders, r.last_reminder, r.status, (current_date - r.due_on) as days_overdue
from supplier_requests r join suppliers s on s.id = r.supplier_id
where r.status in ('open','escalated');

create view v_attention as
select 'non-compliant part' as issue, part_no as ref, regulation as rule, 'used in an active product; declared ' || declared as detail
  from v_part_rule where state = 'non_compliant'
union all
select 'missing declaration', part_no, regulation, 'supplier ' || coalesce(supplier,'(none)') || ' has not declared'
  from v_part_rule where state = 'missing'
union all
select 'expired declaration', part_no, regulation, 'expired ' || valid_until::text
  from v_part_rule where state = 'expired'
union all
select 'stale after Candidate List update', part_no, regulation, 'declared ' || received_on::text || ', list updated ' || (select value from settings where key='candidate_list_updated')
  from v_part_rule where state = 'stale'
union all
select 'exemption expiring', part_no, regulation, exemption || ' expires ' || exemption_expires::text
  from v_exemptions where exemption_expires is not null and exemption_expires <= current_date + 180
union all
select 'conflict minerals template', supplier, 'CONFLICT-MINERALS',
  case state when 'missing' then 'no template on file' when 'expired' then 'template from ' || received_on::text || ' is out of date' else smelters_not_conformant || ' smelter(s) not conformant' end
  from v_supplier_cmrt where state <> 'compliant'
union all
select 'supplier request overdue', supplier, regulation, days_overdue || ' day(s) overdue, ' || reminders || ' reminder(s) sent'
  from v_open_supplier_requests where due_on < current_date
union all
select 'customer request due', pd.code, c.regulation, c.customer || ' due ' || c.due_on::text
  from customer_requests c join products pd on pd.id = c.product_id
  where c.status = 'open' and c.due_on <= current_date + 7
union all
select distinct 'SCIP notification missing', product, 'REACH-SVHC', 'contains a Candidate List substance above 0.1% and sells in the EU'
  from v_svhc where scip_ref is null and markets && array['EU'];

create view v_compliance as
select 'declaration has no document' as rule, p.part_no as ref, d.regulation || ' received ' || d.received_on::text as finding
  from declarations d join parts p on p.id = d.part_id where d.document_ref is null or btrim(d.document_ref) = ''
union all
select 'listed substance declared without detail', p.part_no, d.regulation
  from declarations d join parts p on p.id = d.part_id
  where d.status = 'contains_listed' and not exists (select 1 from declaration_substances x where x.declaration_id = d.id)
union all
select 'RoHS limit exceeded but declared compliant', p.part_no, s.name || ' at ' || ds.concentration_ppm || ' ppm, limit ' || s.rohs_limit_ppm
  from declarations d join parts p on p.id = d.part_id
  join declaration_substances ds on ds.declaration_id = d.id join substances s on s.id = ds.substance_id
  where d.regulation = 'EU-ROHS' and d.status = 'compliant' and s.rohs_limit_ppm is not null and ds.concentration_ppm > s.rohs_limit_ppm
union all
select 'certificate issued while not compliant', pd.code, c.regulation || ' to ' || c.issued_to || ' on ' || c.issued_on::text
  from certificates c join products pd on pd.id = c.product_id
  where c.status_at_issue not in ('compliant','compliant_exemption','contains_listed')
union all
select 'part with no supplier', part_no, description from parts where active and supplier_id is null
union all
select 'product with no parts', code, name from products pd where active and not exists (select 1 from bom b where b.product_id = pd.id)
union all
select 'Candidate List date not set', 'settings', 'set candidate_list_updated so REACH declarations can be checked against it'
  where not exists (select 1 from settings where key = 'candidate_list_updated' and value <> '');

-- Plain records only; nobody reaches these over the network unless you grant it.
do $$ declare t text; begin
  foreach t in array array['settings','suppliers','parts','products','bom','regulations','substances','declarations','declaration_substances','cmrts','supplier_requests','customer_requests','certificates','activity','imports'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;
