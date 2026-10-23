# Lex Vitae

Website for **Lex Vitae Solicitors and Consultants**, Indore.

A single-page static site with no build step and no framework:

```
index.html        page markup, SEO meta and schema.org LegalService data
css/site.css      all styles (mobile-first, CSS custom properties)
js/site.js        disclaimer, mobile nav, practice-area tabs, contact form
images/           hero.webp, about.webp/.jpg, favicon.svg
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Deploy

Any static host works (GitHub Pages, Netlify, Cloudflare Pages). For GitHub Pages:
Settings → Pages → Deploy from branch → `main` / root.

## Things to know

- **Bar Council of India disclaimer.** Advocates in India may not advertise or solicit work, so the
  site shows a disclaimer that visitors must accept before browsing (remembered in `localStorage`).
  It can be reopened from the footer.
- **Contact form** has no backend: it validates the fields and opens the visitor's email app with a
  pre-filled message to the address in `CONTACT_EMAIL` (`js/site.js`). To receive submissions
  directly, point the form at a service such as Formspree or Netlify Forms.
- **Team photo.** The profile uses a monogram placeholder; swap in a real photo (see the comment in
  the Team section of `index.html`).
- Update the canonical/OG URLs in `<head>` if the site is served from a domain other than
  `lexvitaelegal.com`.
