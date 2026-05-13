r8 — Concept Prototype
Frontend: GitHub Pages
Backend/Auth/Database: Supabase
Optional realtime updates: Supabase Realtime
Optional storage: Supabase Storage
MVP Goals

The prototype should answer one question:

“Can contextual reputation systems feel useful instead of toxic?”

The MVP should be intentionally small.

Core Features
1. Entity Pages

Everything is an “entity.”

Examples:

person
restaurant
pickleball court
Discord server
hiking trail
skydiving company
event
creator

Each entity has:

title
category
description
tags
aggregate reputation
recent reviews

Example:

Entity:
Langford Pickleball Club

Category:
Sports / Pickleball

Tags:
competitive, beginner-friendly, social
2. Review System

Reviews contain:

score (optional)
tags
text review
interaction type
timestamp

Example:

Interaction:
Played doubles match

Tags:
supportive, competitive, funny

Score:
8/10

Avoid:

universal attractiveness ratings
permanent “human value” scores

Focus:

context-specific experiences
3. Reputation Weighting

Not all reviews count equally.

Reviewer credibility increases from:

account age
successful appeals
verified interactions
community trust

This prevents:

brigading
throwaway spam
revenge reviews
4. Appeals System

The most important feature.

Users can:

dispute reviews
attach screenshots/evidence
request moderator review

Moderators can:

remove reviews
reduce visibility
flag manipulation
suspend reviewers

Every moderation action creates:

public audit logs
transparency reports
5. Embeddable Widgets

The killer feature.

Example embeds:

<script src="https://r8-app.github.io/embed.js"></script>

<div data-r8="entity_123"></div>

Possible widgets:

review summary
trust score
recent tags
recommendation percentage

Use cases:

personal sites
Discord bots
community forums
event pages
creator portfolios
Database Schema (Supabase)
profiles
id uuid primary key
username text unique
bio text
created_at timestamp
trust_score float
entities
id uuid primary key
title text
category text
description text
created_by uuid
created_at timestamp
reviews
id uuid primary key
entity_id uuid
reviewer_id uuid
score int
content text
interaction_type text
created_at timestamp
status text
review_tags
review_id uuid
tag text
appeals
id uuid primary key
review_id uuid
submitted_by uuid
reason text
evidence_url text
status text
created_at timestamp
GitHub Pages Structure
/docs
  index.html
  entity.html
  profile.html
  moderation.html
  embed.js
  styles.css

Deployment:

push to GitHub
enable Pages
frontend auto-hosts

Supabase handles:

auth
DB
APIs
realtime
Prototype UI Flow
Homepage
trending entities
recent reviews
categories
search bar
Entity Page
aggregate reputation
review feed
appeal buttons
tags cloud
Profile Page
authored reviews
credibility metrics
moderation history
Important Design Philosophy

The app succeeds or fails based on:

fairness
moderation quality
contextual reputation
preventing permanent social punishment

The prototype should deliberately avoid:

“rate humans 1–10”
popularity farming
permanent negative labeling

Instead:

emphasize experiences
emphasize context
emphasize accountability

Because otherwise the app becomes:

“social credit score but crowdsourced.”

r8 would be owned by ermn. so add "powered by ermn." with ermns branding and stuff, r8 shouldn't feel like ermn though
