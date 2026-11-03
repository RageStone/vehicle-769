# Vehicle Guardian

Create a simple, clean, organized vehicle inspection tracking website.



Purpose:

Track military/organization vehicles by category, vehicle number, notes, and inspection history.



Language:

Hebrew RTL interface by default, but code should be clean and easy to translate later.



Main features:



1. Dashboard

- Show total vehicles

- Vehicles checked today

- Vehicles not checked yet

- Vehicles overdue for inspection

- Search bar by vehicle number, category, or note

- Filter by vehicle type/category



2. Vehicle list

Each vehicle card/table row should show:

- Vehicle category

- Vehicle number

- Notes / role, for example: מח"ט, סמח"ט, רפואה, ממוגן

- Last inspection date

- Last inspection status

- Button: “בדיקה חדשה”

- Button: “עריכה”



3. Add inspection

When clicking “בדיקה חדשה”, open a simple form:

- Vehicle number, auto-filled

- Inspection date, default today

- Status:

  - תקין

  - לא תקין

  - לא נבדק

- Free text notes

- Save button



Each vehicle must keep full inspection history.



4. Vehicle details page/modal

Show:

- Vehicle info

- Full inspection history sorted newest first

- Add new inspection

- Edit vehicle details

- Delete vehicle only after confirmation



5. Add vehicles manually

Create a form:

- Vehicle category

- Vehicle number

- Notes

- Save

Allow adding one vehicle or multiple vehicles quickly.



6. Import data

Add an import screen where the user can paste text or upload CSV/Excel.

The import should support this structure:

- Category title

- Vehicle numbers under it

- Optional notes after vehicle number



Example:

דויד טויוטה

617598 מחט

617597 סמחט

617176



The app should automatically parse the category, vehicle number, and notes.

After parsing, show a preview table before saving:

- Category

- Vehicle number

- Notes

User can edit rows before confirming import.



7. Data organization

Use three main database tables:



vehicles:

- id

- category

- vehicle_number

- notes

- created_at

- updated_at



inspections:

- id

- vehicle_id

- inspection_date

- status

- notes

- created_at



categories:

- id

- name



8. UI design

- Very simple and practical

- Mobile-first

- RTL layout

- Use cards on mobile and table on desktop

- Minimal colors:

  - green for תקין

  - red for לא תקין

  - gray for לא נבדק

  - blue for main actions

- Sticky search/filter area

- Clear buttons

- No unnecessary animations

- Fast and readable



9. Extra useful features

- Export to Excel/CSV

- Sort by vehicle number, category, or last inspection date

- Mark multiple vehicles as checked at once

- Bulk import and bulk delete

- Confirmation before deleting

- Local date format: DD/MM/YYYY



Build it as a complete working app with clean components, simple state management, and responsive layout.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vehicle-769.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d51e6d99-42f6-4089-8d93-77e71050f930).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
