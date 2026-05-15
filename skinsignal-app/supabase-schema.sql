create extension if not exists pgcrypto;

create table if not exists clinic_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  city text not null,
  plan text not null,
  owner text not null,
  google_review_link text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  rating integer not null,
  source text not null,
  text text not null,
  draft text not null,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists patients (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  visit_date date not null,
  review_status text not null,
  feedback_status text not null,
  phone text not null default '',
  email text not null default '',
  next_follow_up date,
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  sent integer not null default 0,
  delivered integer not null default 0,
  clicked integer not null default 0,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists enquiries (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  status text not null,
  note text not null,
  phone text not null default '',
  preferred_channel text not null default 'whatsapp',
  next_follow_up date,
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  mobile text not null default '',
  city text not null default '',
  doctor text not null default '',
  appointment_date date not null,
  status text not null,
  updated_at timestamptz not null default now()
);

create table if not exists automation_tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  title text not null,
  contact_name text not null,
  channel text not null,
  due_at text not null,
  status text not null,
  source text not null,
  message text not null,
  updated_at timestamptz not null default now()
);

alter table clinic_settings add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table clinic_settings add column if not exists google_review_link text not null default '';
alter table clinic_settings add column if not exists updated_at timestamptz not null default now();

alter table reviews add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table reviews add column if not exists updated_at timestamptz not null default now();

alter table patients add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table patients add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'visitdate'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'patients'
        and column_name = 'visit_date'
    ) then
      execute 'alter table patients rename column visitdate to visit_date';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'reviewstatus'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'patients'
        and column_name = 'review_status'
    ) then
      execute 'alter table patients rename column reviewstatus to review_status';
    end if;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patients'
      and column_name = 'feedbackstatus'
  ) then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'patients'
        and column_name = 'feedback_status'
    ) then
      execute 'alter table patients rename column feedbackstatus to feedback_status';
    end if;
  end if;
end $$;

alter table patients add column if not exists visit_date date;
alter table patients add column if not exists review_status text;
alter table patients add column if not exists feedback_status text;
alter table patients add column if not exists phone text not null default '';
alter table patients add column if not exists email text not null default '';
alter table patients add column if not exists next_follow_up date;

alter table patients alter column visit_date set not null;
alter table patients alter column review_status set not null;
alter table patients alter column feedback_status set not null;

alter table campaigns add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table campaigns add column if not exists updated_at timestamptz not null default now();

alter table enquiries add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table enquiries add column if not exists phone text not null default '';
alter table enquiries add column if not exists preferred_channel text not null default 'whatsapp';
alter table enquiries add column if not exists next_follow_up date;
alter table enquiries add column if not exists updated_at timestamptz not null default now();

alter table appointments add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table appointments add column if not exists mobile text not null default '';
alter table appointments add column if not exists city text not null default '';
alter table appointments add column if not exists doctor text not null default '';
alter table appointments add column if not exists appointment_date date;
alter table appointments add column if not exists status text;
alter table appointments add column if not exists updated_at timestamptz not null default now();
alter table appointments alter column appointment_date set not null;
alter table appointments alter column status set not null;

alter table automation_tasks add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table automation_tasks add column if not exists updated_at timestamptz not null default now();

delete from clinic_settings where user_id is null;
delete from reviews where user_id is null;
delete from patients where user_id is null;
delete from campaigns where user_id is null;
delete from enquiries where user_id is null;
delete from appointments where user_id is null;
delete from automation_tasks where user_id is null;

alter table clinic_settings alter column user_id set not null;
alter table reviews alter column user_id set not null;
alter table patients alter column user_id set not null;
alter table campaigns alter column user_id set not null;
alter table enquiries alter column user_id set not null;
alter table appointments alter column user_id set not null;
alter table automation_tasks alter column user_id set not null;

alter table clinic_settings drop constraint if exists clinic_settings_pkey;
alter table reviews drop constraint if exists reviews_pkey;
alter table patients drop constraint if exists patients_pkey;
alter table campaigns drop constraint if exists campaigns_pkey;
alter table enquiries drop constraint if exists enquiries_pkey;
alter table appointments drop constraint if exists appointments_pkey;
alter table automation_tasks drop constraint if exists automation_tasks_pkey;

alter table clinic_settings add constraint clinic_settings_pkey primary key (user_id, id);
alter table reviews add constraint reviews_pkey primary key (user_id, id);
alter table patients add constraint patients_pkey primary key (user_id, id);
alter table campaigns add constraint campaigns_pkey primary key (user_id, id);
alter table enquiries add constraint enquiries_pkey primary key (user_id, id);
alter table appointments add constraint appointments_pkey primary key (user_id, id);
alter table automation_tasks add constraint automation_tasks_pkey primary key (user_id, id);

create index if not exists clinic_settings_user_updated_idx on clinic_settings (user_id, updated_at desc);
create index if not exists reviews_user_updated_idx on reviews (user_id, updated_at desc);
create index if not exists patients_user_updated_idx on patients (user_id, updated_at desc);
create index if not exists campaigns_user_updated_idx on campaigns (user_id, updated_at desc);
create index if not exists enquiries_user_updated_idx on enquiries (user_id, updated_at desc);
create index if not exists appointments_user_updated_idx on appointments (user_id, updated_at desc);
create index if not exists automation_tasks_user_updated_idx on automation_tasks (user_id, updated_at desc);

alter table clinic_settings enable row level security;
alter table reviews enable row level security;
alter table patients enable row level security;
alter table campaigns enable row level security;
alter table enquiries enable row level security;
alter table appointments enable row level security;
alter table automation_tasks enable row level security;

drop policy if exists "users read own clinic_settings" on clinic_settings;
create policy "users read own clinic_settings"
on clinic_settings for select
using (auth.uid() = user_id);

drop policy if exists "users write own clinic_settings" on clinic_settings;
create policy "users write own clinic_settings"
on clinic_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own reviews" on reviews;
create policy "users read own reviews"
on reviews for select
using (auth.uid() = user_id);

drop policy if exists "users write own reviews" on reviews;
create policy "users write own reviews"
on reviews for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own patients" on patients;
create policy "users read own patients"
on patients for select
using (auth.uid() = user_id);

drop policy if exists "users write own patients" on patients;
create policy "users write own patients"
on patients for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own campaigns" on campaigns;
create policy "users read own campaigns"
on campaigns for select
using (auth.uid() = user_id);

drop policy if exists "users write own campaigns" on campaigns;
create policy "users write own campaigns"
on campaigns for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own enquiries" on enquiries;
create policy "users read own enquiries"
on enquiries for select
using (auth.uid() = user_id);

drop policy if exists "users write own enquiries" on enquiries;
create policy "users write own enquiries"
on enquiries for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own appointments" on appointments;
create policy "users read own appointments"
on appointments for select
using (auth.uid() = user_id);

drop policy if exists "users write own appointments" on appointments;
create policy "users write own appointments"
on appointments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users read own automation_tasks" on automation_tasks;
create policy "users read own automation_tasks"
on automation_tasks for select
using (auth.uid() = user_id);

drop policy if exists "users write own automation_tasks" on automation_tasks;
create policy "users write own automation_tasks"
on automation_tasks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
