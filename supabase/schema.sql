-- ============================================================
-- TFA Referee Performance Platform — Database Schema
-- Run this in Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Events (tournaments / cups)
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  starts_on   date,
  ends_on     date,
  created_at  timestamptz not null default now()
);

-- Referees (the roster — separate from coded names in XML)
create table if not exists referees (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  squad           text,         -- NRS / NMRS / ARS
  accreditation   text,
  email           text unique,
  auth_user_id    uuid unique,  -- links to auth.users once they log in
  created_at      timestamptz not null default now()
);

-- Games (one XML file = one game)
create table if not exists games (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  name          text not null,           -- e.g. "MO TT G1"
  game_date     date,
  source_file   text,                    -- original filename
  hudl_link     text,                    -- full-game Hudl share URL for deep-linking
  raw_xml       text,                    -- stored for re-processing
  uploaded_by   uuid references auth.users(id),
  uploaded_at   timestamptz not null default now(),
  constraint games_event_file_unique unique (event_id, source_file)
);

-- Maps free-text coded names from XML to referee roster entries
-- Requires admin confirmation step before decisions are linked
create table if not exists referee_game_assignments (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references games(id) on delete cascade,
  referee_id      uuid not null references referees(id),
  coded_name      text not null,   -- raw <code> value from XML
  confirmed_by    uuid references auth.users(id),
  confirmed_at    timestamptz,
  constraint rga_unique unique (game_id, coded_name)
);

-- One row per <instance> in the XML
create table if not exists decisions (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references games(id) on delete cascade,
  referee_id      uuid references referees(id),   -- null until assignment confirmed
  instance_id     int not null,                   -- ID from XML, scoped to game
  start_sec       numeric not null,
  end_sec         numeric not null,
  flag            int not null default 0,
  instance_note   text,
  constraint decisions_game_instance_unique unique (game_id, instance_id)
);

-- One row per <label> on a decision
create table if not exists decision_labels (
  id              uuid primary key default gen_random_uuid(),
  decision_id     uuid not null references decisions(id) on delete cascade,
  group_normalised text not null,  -- GENERAL | CRITICAL | ACCURACY | PENALTY | COP | TRY | GAME DEC
  group_raw       text not null,   -- original value from XML (preserves PENATLY etc. for audit)
  text            text not null
);

-- Audit trail for uploads and name corrections
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id),
  action      text not null,   -- 'xml_upload' | 'name_confirmed' | 'name_corrected' | 'game_reprocessed'
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes for dashboard queries
-- ============================================================
create index if not exists idx_decisions_game       on decisions(game_id);
create index if not exists idx_decisions_referee    on decisions(referee_id);
create index if not exists idx_decision_labels_dec  on decision_labels(decision_id);
create index if not exists idx_decision_labels_grp  on decision_labels(group_normalised);
create index if not exists idx_games_event          on games(event_id);
create index if not exists idx_rga_game             on referee_game_assignments(game_id);
create index if not exists idx_rga_referee          on referee_game_assignments(referee_id);

-- ============================================================
-- Convenience view: accuracy stats per decision
-- Joins ACCURACY label back onto the decision for easy querying
-- ============================================================
create or replace view decision_accuracy as
select
  d.id              as decision_id,
  d.game_id,
  d.referee_id,
  d.instance_id,
  d.start_sec,
  d.end_sec,
  g.event_id,
  g.game_date,
  -- decision importance
  case
    when exists (select 1 from decision_labels dl where dl.decision_id = d.id and dl.group_normalised = 'CRITICAL') then 'CRITICAL'
    else 'GENERAL'
  end as importance,
  -- accuracy
  (select dl.text from decision_labels dl where dl.decision_id = d.id and dl.group_normalised = 'ACCURACY' limit 1) as accuracy,
  -- call type (PENALTY / COP / TRY / GAME DEC text)
  (select dl.group_normalised from decision_labels dl where dl.decision_id = d.id and dl.group_normalised in ('PENALTY','COP','TRY','GAME DEC') limit 1) as call_group,
  (select dl.text from decision_labels dl where dl.decision_id = d.id and dl.group_normalised in ('PENALTY','COP','TRY','GAME DEC') limit 1) as call_text,
  -- missed decision flag
  exists (select 1 from decision_labels dl where dl.decision_id = d.id and dl.group_normalised = 'GENERAL' and dl.text = 'MISSED DM') as is_missed
from decisions d
join games g on g.id = d.game_id;
