-- Initial schema for the driving instructor app.
-- Solo instructors first: every instructor belongs to a school, and a solo
-- instructor simply gets a one-person school, so multi-instructor schools can
-- be added later without reshaping the data.

create extension if not exists btree_gist;

create type public.user_role as enum ('instructor', 'student');
create type public.payment_method as enum ('stripe', 'bank_transfer', 'cash');
create type public.booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded', 'waived');
create type public.late_fee_policy as enum ('none', 'full', 'fixed', 'percent');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null default '',
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.instructors (
  id uuid primary key references public.profiles (id) on delete cascade,
  school_id uuid not null references public.schools (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  bio text,
  timezone text not null default 'Europe/London',

  -- Lessons and booking rules
  hourly_rate_pence integer not null default 4000 check (hourly_rate_pence >= 0),
  lesson_durations integer[] not null default '{60,120}',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes in (15, 30, 60)),
  min_notice_hours integer not null default 24 check (min_notice_hours >= 0),
  booking_window_days integer not null default 28 check (booking_window_days between 1 and 180),

  -- Payment options
  accepts_stripe boolean not null default false,
  accepts_bank_transfer boolean not null default true,
  accepts_cash boolean not null default true,
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,

  -- Cancellations and terms
  cancellation_notice_hours integer not null default 48 check (cancellation_notice_hours >= 0),
  late_fee_policy public.late_fee_policy not null default 'full',
  late_fee_fixed_pence integer check (late_fee_fixed_pence >= 0),
  late_fee_percent integer check (late_fee_percent between 0 and 100),
  terms_version integer not null default 0,

  progress_tracking_enabled boolean not null default false,

  -- Instructor's own subscription to the app
  subscription_status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  stripe_customer_id text,
  stripe_subscription_id text,

  created_at timestamptz not null default now()
);

-- Every version of an instructor's terms is kept so a booking can always point
-- at exactly what the student accepted.
create table public.instructor_terms (
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  version integer not null,
  body text not null,
  created_at timestamptz not null default now(),
  primary key (instructor_id, version)
);

create table public.instructor_students (
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (instructor_id, student_id)
);

-- Weekly recurring availability, in the instructor's local time.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  price_pence integer not null check (price_pence >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'unpaid',
  stripe_checkout_session_id text,
  pickup_location text,
  student_notes text,
  terms_version integer not null,
  terms_accepted_at timestamptz not null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancellation_reason text,
  late_cancellation boolean not null default false,
  late_fee_pence integer not null default 0 check (late_fee_pence >= 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- The database itself refuses double bookings, so instant booking is safe
  -- even when two students grab the same slot at the same moment.
  constraint bookings_no_overlap exclude using gist (
    instructor_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelled')
);

create index bookings_instructor_starts_idx on public.bookings (instructor_id, starts_at);
create index bookings_student_starts_idx on public.bookings (student_id, starts_at);

-- Optional per-instructor progress checklist.
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructors (id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- level: 0 not started, 1 introduced, 2 under instruction, 3 prompted,
-- 4 seldom prompted, 5 independent.
create table public.skill_progress (
  student_id uuid not null references public.profiles (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  level smallint not null default 0 check (level between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (student_id, skill_id)
);

-- Stops the reminder job from sending the same message twice.
create table public.reminder_log (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null,
  channel text not null,
  sent_at timestamptz not null default now(),
  primary key (booking_id, kind, channel)
);

-- ---------------------------------------------------------------------------
-- Helpers used by row level security
-- ---------------------------------------------------------------------------

create or replace function public.is_student_of(p_instructor uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.instructor_students
    where instructor_id = p_instructor and student_id = p_student
  );
$$;

-- ---------------------------------------------------------------------------
-- New users: create their profile, and for instructors a one-person school.
-- Sign-up metadata: role, full_name, phone, and join_slug for students who
-- arrive through an instructor's booking link.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role;
  v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_school uuid;
  v_base text;
  v_instructor uuid;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student')::public.user_role;

  insert into public.profiles (id, role, full_name, email, phone)
  values (new.id, v_role, v_name, coalesce(new.email, ''), new.raw_user_meta_data ->> 'phone');

  if v_role = 'instructor' then
    insert into public.schools (name, owner_id)
    values (coalesce(nullif(v_name, ''), 'My') || ' Driving School', new.id)
    returning id into v_school;

    v_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
    if length(v_base) < 3 then
      v_base := 'instructor';
    end if;

    insert into public.instructors (id, school_id, slug)
    values (new.id, v_school, left(v_base, 34) || '-' || substr(md5(random()::text), 1, 4));
  elsif new.raw_user_meta_data ->> 'join_slug' is not null then
    select id into v_instructor from public.instructors
    where slug = new.raw_user_meta_data ->> 'join_slug';
    if v_instructor is not null then
      insert into public.instructor_students (instructor_id, student_id)
      values (v_instructor, new.id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- Reads go through RLS. Writes that need business rules (booking, cancelling,
-- joining an instructor) run on the server with the service role after the
-- app has checked who the user is.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.instructors enable row level security;
alter table public.instructor_terms enable row level security;
alter table public.instructor_students enable row level security;
alter table public.availability_rules enable row level security;
alter table public.time_off enable row level security;
alter table public.bookings enable row level security;
alter table public.skills enable row level security;
alter table public.skill_progress enable row level security;
alter table public.reminder_log enable row level security;

-- profiles
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "instructors read their students" on public.profiles
  for select using (public.is_student_of(auth.uid(), id));
create policy "students read their instructors" on public.profiles
  for select using (public.is_student_of(id, auth.uid()));
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.prevent_role_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.role <> old.role then
    raise exception 'role cannot be changed';
  end if;
  return new;
end;
$$;

create trigger profiles_role_locked
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- schools
create policy "owner reads school" on public.schools
  for select using (owner_id = auth.uid());
create policy "owner updates school" on public.schools
  for update using (owner_id = auth.uid());

-- instructors
create policy "instructor reads self" on public.instructors
  for select using (id = auth.uid());
create policy "students read their instructors" on public.instructors
  for select using (public.is_student_of(id, auth.uid()));
-- No update policy: settings are saved by the server so instructors cannot
-- edit fields like subscription_status directly.

-- instructor_terms
create policy "instructor reads own terms" on public.instructor_terms
  for select using (instructor_id = auth.uid());
create policy "students read instructor terms" on public.instructor_terms
  for select using (public.is_student_of(instructor_id, auth.uid()));

-- instructor_students
create policy "either side reads link" on public.instructor_students
  for select using (instructor_id = auth.uid() or student_id = auth.uid());
create policy "instructor removes student" on public.instructor_students
  for delete using (instructor_id = auth.uid());

-- availability_rules
create policy "instructor manages availability" on public.availability_rules
  for all using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());
create policy "students read availability" on public.availability_rules
  for select using (public.is_student_of(instructor_id, auth.uid()));

-- time_off
create policy "instructor manages time off" on public.time_off
  for all using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());
create policy "students read time off" on public.time_off
  for select using (public.is_student_of(instructor_id, auth.uid()));

-- bookings
create policy "instructor reads bookings" on public.bookings
  for select using (instructor_id = auth.uid());
create policy "student reads own bookings" on public.bookings
  for select using (student_id = auth.uid());

-- skills
create policy "instructor manages skills" on public.skills
  for all using (instructor_id = auth.uid()) with check (instructor_id = auth.uid());
create policy "students read skills" on public.skills
  for select using (public.is_student_of(instructor_id, auth.uid()));

-- skill_progress
create policy "instructor manages progress" on public.skill_progress
  for all using (
    exists (select 1 from public.skills s where s.id = skill_id and s.instructor_id = auth.uid())
    and public.is_student_of(auth.uid(), student_id)
  ) with check (
    exists (select 1 from public.skills s where s.id = skill_id and s.instructor_id = auth.uid())
    and public.is_student_of(auth.uid(), student_id)
  );
create policy "student reads own progress" on public.skill_progress
  for select using (student_id = auth.uid());

-- reminder_log: service role only (no policies).
