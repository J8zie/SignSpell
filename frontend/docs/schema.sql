-- PostgreSQL (Supabase) schema that matches the ERD. camelCase JSON <-> snake_case columns.
create extension if not exists "pgcrypto";

create table users (
  user_id    uuid primary key default gen_random_uuid(),
  username   varchar(20) not null unique,
  password   text        not null,                      -- bcrypt hash (Laravel Hash::make)
  role       varchar(10) not null check (role in ('learner', 'teacher', 'admin'))
);

create table userinfo (
  userinfo_id       uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references users(user_id) on delete cascade,
  first_name        varchar(60)  not null,
  last_name         varchar(60)  not null,
  email             varchar(190) not null unique,
  profile_photo_url text,
  created_at        timestamptz not null default now()
);

create table signs (
  sign_id           uuid primary key default gen_random_uuid(),
  sign_type         varchar(10) not null check (sign_type in ('letter', 'word', 'sentence')),
  image_url         text,                                -- Cloudinary secure URL
  label             varchar(80) not null,                -- UPPERCASE, single spaces
  created_at        timestamptz not null default now(),
  userownership_id  uuid references users(user_id) on delete set null,   -- the teacher who donated it (null = SignSpell)
  unique (sign_type, label)
);
create index signs_owner_idx on signs (userownership_id);

create table attempts (
  attempts_id      uuid primary key default gen_random_uuid(),
  learners_id      uuid not null references users(user_id) on delete cascade,
  sign_id          uuid not null references signs(sign_id) on delete cascade,
  predicted_label  varchar(80) not null,
  confidence       numeric(4,3) not null check (confidence between 0 and 1),
  is_correct       boolean not null,
  created_at       timestamptz not null default now()
);
create index attempts_learner_idx on attempts (learners_id, created_at desc);
create index attempts_sign_idx on attempts (sign_id, created_at desc);

create table mastery (
  mastery_id     uuid primary key default gen_random_uuid(),
  learners_id    uuid not null references users(user_id) on delete cascade,
  sign_id        uuid not null references signs(sign_id) on delete cascade,
  attempts_count integer      not null default 0,
  correct_avg    numeric(4,3) not null default 0 check (correct_avg between 0 and 1),
  mastery_level  varchar(10)  not null default 'new' check (mastery_level in ('new', 'learning', 'familiar', 'mastered')),
  updated_at     timestamptz  not null default now(),
  unique (learners_id, sign_id)
);
