CYBERTRACE

A full-stack cybersecurity education platform built with Node.js, Express, SQLite, vanilla JavaScript, Bootstrap 5, Chart.js, and bcrypt.

Run
bash
npm install
npm start

Open http://localhost:3000 (Node 18 or newer).

First admin account

On first start an admin (admin@cybertrace.io) is created. Its password is ADMIN_INITIAL_PASSWORD if you set it, otherwise a random password is printed once in the server console. You must change it after logging in. If you are upgrading an existing database, reset the old admin password from the admin panel.

AI Kali Tutor

The terminal (workstation and Lab section) has an AI KALI TUTOR panel. Set ANTHROPIC_API_KEY on the server (see .env.example) and log in to use the AI tutor; without a key the built-in offline tutor answers common questions. In the terminal you can also type tutor <question>. The key stays on the server and is never sent to the browser.

Files

Put index.html, app.js, tutor-ui.js and the CSS files either next to server.js or in a public/ folder. Keep the .db files out of public/.