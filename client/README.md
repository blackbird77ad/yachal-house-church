git commit -m "Fix portal weekReference - closing Monday logic across entire system"

Yachal House Worker Portal

This is the internal management system for Yachal House Church, Ridge, Accra.
Access is by invitation only. This is not a public application.


What it does

Workers use this portal to submit their weekly evangelism and follow up report.
Admins use it to review submissions, track qualification scores, build the service roster and record attendance.


How the week works

The system runs on a fixed weekly cycle.

Monday at 3pm marks the start of a new week. The portal is closed and workers can only save drafts.

On Friday at midnight the portal opens. Workers can now submit their report for the week.

On Monday at 2:59pm the portal closes. The system automatically calculates qualification scores for all workers.

The cycle then repeats.


Roles

Pastor has full access to everything in the system.

Admin can manage workers, view and review reports, run qualification and build the roster.

Moderator can view reports and qualification results.

Worker can submit their weekly report, view their own report history and check the published roster.


Technology

The frontend is built with React and hosted on Cloudflare Pages.
The backend is built with Node.js and Express and hosted on Render.
The database is MongoDB Atlas.


Access

This system is privately maintained. Contact the system administrator for credentials or access.