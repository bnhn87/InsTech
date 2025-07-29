# InsTech MVP

This repository provides a **minimal but extensible implementation** of the InsTech MVP described in the project specification.  It uses **Supabase** as the backend data store, **Next.js** for the web client, and **React Native (Expo)** for the mobile application.  The goal of this code is to deliver the core flows—installer entry, project creation, floor‑plan markup, status submission, project completion and role‑based access—without unnecessary complexity.  It is intentionally lean to enable rapid iteration and deployment.

> **Important:** This code is a starting point and does not implement every single edge case or advanced feature (e.g. multilingual JSON files, offline caching, AI/LLM support for flagging unassigned items).  These can be added iteratively.

## Recent additions

The project has evolved beyond the initial MVP to include several new capabilities:

* **Branded landing page** – A polished home page with a cityscape backdrop, InsTech/BH branding and a modal login/request‑account flow.  The authentication panel appears only when the corresponding button is clicked.
* **Admin dashboard** – A new `/dashboard` page lists all projects for which the user has admin privileges.  Projects can be edited in place (title, reference, PO number, start dates, addresses, labour requirements and auto‑assign flags) and opened with a single click.
* **Installation‑time quoting engine** – The `backend/quote_engine.py` module now estimates total installation hours instead of product cost.  It maps product codes to install times and computes overall labour requirements.  Replace the placeholder installation times with your real data from the “Quoting with hours” project.
* **Feature toggles and measurement tools** – Users can enable/disable advanced features (AI assignment, measurement tools, forms, markups) on the settings page.  The floor‑plan editor supports drawing rectangles and measurement lines with optional labels.

## Contents

```
instech_mvp/
├── supabase/
│   └── schema.sql        # SQL for Supabase schema and RLS policies
├── web/
│   ├── package.json      # Next.js web client
│   ├── next.config.js
│   ├── pages/
│   │   ├── index.tsx     # Landing / login / registration
│   │   ├── project.tsx   # Admin project creation
│   │   ├── job.tsx       # Installer job view (via labour link)
│   │   └── floorplan.tsx # Floor plan upload and pin placement
│   ├── components/
│   │   └── ...           # Reusable UI components
│   └── README.md
├── mobile/
│   ├── package.json      # Expo React Native app
│   ├── App.tsx
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── JobScreen.tsx
│   │   ├── FloorPlanScreen.tsx
│   │   └── CreateProjectScreen.tsx
│   └── README.md
└── README.md             # This file
```

## Supabase schema

The `supabase/schema.sql` file defines the core tables, relationships and [Row‑Level Security policies](https://supabase.com/docs/learn/auth-deep-dive/auth-row-level-security) required for the MVP:

* **Projects** – stores metadata about jobs: title, reference, dates, contacts, etc.
* **Floor plans** – links uploaded floor plan files to a project.
* **Pins** – each pin marks a product location on the floor plan with status, label, coordinates, description and associated photo.
* **Products** – stores work order line items with code, name and quantity; can be assigned to pins via a join table.
* **Users** – holds installer/supervisor/admin accounts with role and language settings; includes a `labour_token` for single‑click job access.
* **Snags** – captures unresolved issues to generate sub‑projects when a job isn’t fully complete.
* **Documents** – stores upload references (WO/Delivery notes and RAMS) in Supabase buckets.

Each table has RLS policies to ensure users only see data they are allowed to.  You must run this SQL in your Supabase project’s query editor to create the schema.  See [`supabase/schema.sql`](supabase/schema.sql) for the full definition.

### Additional features and scaffolding

Beyond the core CRUD flows, the codebase provides scaffolding for several advanced requirements described in the MVP:

* **Multilingual support** – Translation files under `locales/` (currently English and Spanish) and helper functions detect the user’s language and provide translated strings in both the web and mobile clients.  Add further languages by creating new JSON files and updating the detection logic.
* **AI‑powered item assignment** – `backend/ai.py` exposes a stubbed `ai_assign_products()` function.  In production, connect this function to your AI/LLM service to suggest the optimal location for unassigned products on a floor plan.
* **PDF parsing** – `backend/pdf_parser.py` illustrates how to extract project metadata and product lines from work order PDFs using the `pdfplumber` library.  You can run this script as a background job or wrap it in a Supabase Edge Function to parse uploaded documents automatically.
* **Offline sync** – `web/lib/offline.ts` and `mobile/utils/offline.ts` provide simple helpers for saving form data and pins to local storage when the device is offline.  You need to call these helpers in your components to enable offline behaviour and replay the data when connectivity is restored.
* **Job tracking** – The `projects` table includes a `status` field (`pending`, `in_progress`, `complete`) to track project state.  Extend the UI and backend to update this field based on installer actions and supervisor overrides.
* **Quote engine integration** – `backend/quote_engine.py` outlines how to send project and product data to an external pricing service.  Replace the dummy implementation with calls to your internal quote engine if you need automated cost calculations.
* **Image search stub** – `backend/image_search.py` provides a placeholder for integrating with an external image search API (Unsplash, Google Custom Search, etc.) to fetch product pictures that can be used as icons on the floor plan.  Replace it with actual API calls and supply your API key.

## Web client (Next.js)

The web client uses Next.js with TypeScript.  It integrates with Supabase via the official [Supabase JavaScript client](https://supabase.com/docs/reference/javascript).  Each page corresponds to one of the flows described in the MVP:

* **`pages/index.tsx`** – Landing page with login and register forms.  After login the user is redirected based on their role.
* **`pages/project.tsx`** – Admin view to create projects; maps directly to the form specification in the MVP.  It saves data to Supabase.
* **`pages/job.tsx`** – Installer view for labour links.  It loads a job by `labour_token`, auto‑detects language, and allows the installer to start the job.
* **`pages/floorplan.tsx`** – Allows floor plan upload and pin placement using a simple canvas.  Pins can be assigned statuses, descriptions and labels, and products can be dragged onto them.  (Drag‑and‑drop of products is stubbed out; left for implementation.)

Use `npm install` then `npm run dev` inside the `web` folder to run the development server.  See [`web/README.md`](web/README.md) for details.

## Mobile client (React Native / Expo)

The mobile app is built with Expo and TypeScript.  It mirrors the web flows in a native UI and communicates with Supabase using the [supabase-js](https://supabase.com/docs/reference/javascript) client as well.  Screens correspond to the installer’s workflow:

* **`LoginScreen`** and **`RegisterScreen`** – account creation and login for roles requiring authentication.
* **`JobScreen`** – accessible via labour token; shows project information, contact details and a “Start Job” button.
* **`FloorPlanScreen`** – camera and file picker to upload a floor plan; allows dropping pins and setting statuses and photos.
* **`CreateProjectScreen`** – admin form to create projects, analogous to the web client.

Run `npm install` then `npm start` in the `mobile` directory to open the Expo development server.  See [`mobile/README.md`](mobile/README.md) for more.

## Usage

1. Sign in to your Supabase account and create a new project named **InsTech**.
2. Run the SQL in `supabase/schema.sql` using the SQL editor in Supabase.
3. Configure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc.) in both the web and mobile apps.  You can copy `.env.example` to `.env` and fill in your keys.
4. Install dependencies and run the web and mobile apps as described above.
5. Start building additional features (e.g. PDF parsing, multilingual support, offline caching) as required.

This repository provides a solid foundation to build the InsTech MVP.  You can further customise UI/UX, integrate AI assistants, and implement offline workflows as your product evolves.