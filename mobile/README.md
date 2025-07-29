# InsTech Mobile App

This directory contains the **React Native** implementation of the InsTech MVP.  The app is built using **Expo**, **TypeScript** and the Supabase JavaScript client.  It mirrors the key flows described in the MVP spec: user authentication, project creation, job viewing via labour link, floor plan upload and pin placement.

## Setup

1. Install the [Expo CLI](https://docs.expo.dev/get-started/installation/) if you don’t already have it:

   ```bash
   npm install -g expo-cli
   ```

2. Install dependencies:

   ```bash
   cd mobile
   npm install
   ```

3. Create a `.env` file (or use Expo’s `app.config.js`) to define:

   ```
   EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

4. Start the development server:

   ```bash
   npm start
   ```

   Use the Expo Go app on your mobile device or an emulator to run the app.

## Screens

* **LoginScreen** – Email/password login.  After authentication the app fetches the user’s profile from the `users` table to determine their role.  Admins are taken to the project creation screen; other roles currently show a placeholder alert.
* **RegisterScreen** – Create a new account.  Collects full name, phone number and role (installer, supervisor or admin) and inserts a corresponding row in the `users` table after signing up via Supabase Auth.
* **CreateProjectScreen** – Minimal form to create a project with title, reference, start date/time.  You can extend this form to include all the fields specified in the MVP.
* **JobScreen** – Displays basic project information by its UUID and offers a **Start Job** button that navigates to the floor plan screen.
* **FloorPlanScreen** – Allows the user to pick an image from their device, add dummy pins (with random coordinates) by entering label, status and comment, and save them to the database.  In a real production app you would capture pin coordinates by letting the user tap on the image and perhaps enforce mandatory photo uploads when the status isn’t “complete”.

## Notes

* The app uses Expo’s `ImagePicker` API for selecting images.  It also demonstrates how to upload blobs to Supabase Storage via `fetch(uri)` and `supabase.storage.from().upload()`.
* Navigation is handled with `@react-navigation/native` and `@react-navigation/native-stack`.  The `RootStackParamList` type ensures type safety for route params.
* Offline caching, language detection, AI‑assisted features and the full suite of fields from the MVP are not implemented here.  This is a lean starting point you can iterate on.

* **Multilingual support** – The mobile client includes a simple translation utility (`utils/i18n.ts`) that uses `expo-localization` to detect the device language and loads translation JSONs from `locales/`.  To add languages, create new JSON files and update the import.

* **Offline sync** – Functions in `utils/offline.ts` wrap `AsyncStorage` to save unsent data when the device is offline.  Use these helpers to queue pin submissions or form entries and replay them when connectivity is restored.

* **Pin photos** – When adding a pin, if the status is not “complete” the app prompts the user to capture a photo using the device camera.  The image is uploaded to a `pinphotos` storage bucket on save.  Create this bucket in Supabase Storage and adjust permissions accordingly.