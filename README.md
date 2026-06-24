# WHSF Public Website

This folder contains the new public website for World Humanitarian Support Foundation. It is separate from the WHSF SmartStay application in the project root.

## Preview locally

From PowerShell:

```powershell
cd "C:\Users\tunqu\Documents\Codex\2026-06-19\mvp-concept-for-whsf-whsf-smart\whsf-website"
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Before launch

- Confirm `info@worldhsfoundation.org` is the correct public contact address.
- Add the official donation destination.
- Confirm programme wording and legal/privacy content.
- Deploy this folder as a separate Vercel project.
- Point `worldhsfoundation.org` and `www.worldhsfoundation.org` to that project only after final approval.
