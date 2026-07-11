# Fengchi Liu — Academic Homepage

A lightweight academic website prepared for GitHub Pages.

## Included

- Responsive single-page academic profile
- Profile photo and downloadable CV
- Google Scholar, GitHub, and email links
- About, research interests, news, publications, research experience, education, honors, and service
- GitHub Pages deployment workflow

## Publish with Codex or Git

The target repository is:

```text
LFC-CS-AI/LFC-CS-AI.github.io
```

Copy every file in this folder to the repository root, then commit and push to `main`:

```bash
git add .
git commit -m "Launch academic homepage"
git push origin main
```

In GitHub, open **Settings → Pages**. Under **Build and deployment**, select **GitHub Actions** if it is not already selected. The website should then appear at:

```text
https://lfc-cs-ai.github.io/
```

## Update content

- Main text: `index.html`
- Styling: `assets/css/style.css`
- Photo: `assets/images/fengchi-liu-profile.jpg`
- CV: `assets/cv/Fengchi_Liu_CV.pdf`

For new publications, duplicate one `<article class="publication">...</article>` block in `index.html` and edit the title, authors, venue, year, and status.

## Items to add later

- ORCID link
- DOI/PDF/Code buttons for publications
- Research figures or project thumbnails
- Custom domain, if desired
