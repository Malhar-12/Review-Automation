create table if not exists clinic_settings (
  id text primary key,
  name text not null,
  city text not null,
  plan text not null,
  owner text not null,
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id bigint primary key,
  name text not null,
  rating integer not null,
  source text not null,
  text text not null,
  draft text not null,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists patients (
  id bigint primary key,
  name text not null,
  visitDate date not null,
  reviewStatus text not null,
  feedbackStatus text not null,
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id bigint primary key,
  name text not null,
  sent integer not null default 0,
  delivered integer not null default 0,
  clicked integer not null default 0,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists enquiries (
  id bigint primary key,
  name text not null,
  status text not null,
  note text not null,
  updated_at timestamptz not null default now()
);

alter table clinic_settings enable row level security;
alter table reviews enable row level security;
alter table patients enable row level security;
alter table campaigns enable row level security;
alter table enquiries enable row level security;

drop policy if exists "public read clinic_settings" on clinic_settings;
create policy "public read clinic_settings"
on clinic_settings for select
using (true);

drop policy if exists "public write clinic_settings" on clinic_settings;
create policy "public write clinic_settings"
on clinic_settings for all
using (true)
with check (true);

drop policy if exists "public read reviews" on reviews;
create policy "public read reviews"
on reviews for select
using (true);

drop policy if exists "public write reviews" on reviews;
create policy "public write reviews"
on reviews for all
using (true)
with check (true);

drop policy if exists "public read patients" on patients;
create policy "public read patients"
on patients for select
using (true);

drop policy if exists "public write patients" on patients;
create policy "public write patients"
on patients for all
using (true)
with check (true);

drop policy if exists "public read campaigns" on campaigns;
create policy "public read campaigns"
on campaigns for select
using (true);

drop policy if exists "public write campaigns" on campaigns;
create policy "public write campaigns"
on campaigns for all
using (true)
with check (true);

drop policy if exists "public read enquiries" on enquiries;
create policy "public read enquiries"
on enquiries for select
using (true);

drop policy if exists "public write enquiries" on enquiries;
create policy "public write enquiries"
on enquiries for all
using (true)
with check (true);
