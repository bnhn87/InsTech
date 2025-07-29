# InsTech Web Client

This folder contains the source code for the InsTech MVP **web application**.  It is built with **Next.js** and **TypeScript** and communicates with the Supabase backend defined in the root `supabase/schema.sql`.

## Setup

1. Ensure you have [Node.js](https://nodejs.org/) installed (version 18 or higher is recommended).
2. Copy `.env.example` to `.env.local` and set the following environment variables:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

3. Install dependencies and run the development server:

   ```bash
   cd web
   npm install
   npm run dev
   ```

   The app will be available at http://localhost:3000.

## Pages

* **`index.tsx`** – Landing page with login/register forms.  Handles user authentication via Supabase.  After login, users are redirected to the appropriate page based on their role (currently all roles go to `/project`).
* **`project.tsx`** – Admin view to create new projects.  Follows the form specification in the MVP.  After creation the admin user is added as a project member with role `admin`.
* **`job.tsx`** – Installer job view.  Expects a query parameter `id` with the project UUID.  Displays basic project information and provides a “Start Job” button to navigate to floor plan markup.
* **`floorplan.tsx`** – Floor plan upload and pin placement.  Allows uploading an image (or PDF), previewing it, dropping coloured pins and saving them to Supabase.  This is a minimal implementation; you can extend it with drag‑and‑drop product assignment, PDF parsing, and more sophisticated annotation tools.

* **`tasks.tsx`** – Task dashboard.  Lists all tasks for a given project (passed via the `id` query string).  Users can create new tasks with a title, description, priority, assignee, category and due date, and advance the status of existing tasks.  This feature lays the foundation for punch‑list management and QA/QC workflows.

## Notes

* **File uploads** – The example uses a `floorplans` storage bucket for uploaded floor plan images.  Create this bucket in Supabase Storage and configure its read permissions as appropriate.
* **Authentication & authorisation** – The web client relies on Supabase’s auth and RLS policies defined in the SQL schema.  Make sure your policies are configured correctly to avoid unauthorised access.
* **Language detection and internationalisation** – Not yet implemented.  You can integrate a library like `next-i18next` and store your translations in JSON files to support auto language detection and multilingual UI.
* **Offline mode** – Not implemented.  Consider libraries like `localforage` or `IndexedDB` to cache form data when offline and sync on reconnect.
* **PDF parsing** – To auto‑parse work orders and delivery notes, you can add an API route using Node libraries like `pdf-parse` or call a cloud function.  This is outside the scope of the initial MVP skeleton.

* **Multilingual support** – The web client includes a simple i18n implementation (`lib/i18n.ts`) that auto‑detects the browser language and loads translations from JSON files in `../locales`.  Add more languages by creating new JSON files and importing them.

* **Offline sync** – Helper functions in `lib/offline.ts` allow you to persist form data and pins in `localStorage` when the network is unavailable.  Call `saveOffline()` before making API requests and replay the data when connectivity returns.

* **Pin photos** – The floor plan page supports attaching images to individual pins via an additional file input.  Uploaded photos are stored in a `pinphotos` storage bucket.  Ensure you create this bucket and configure its permissions.