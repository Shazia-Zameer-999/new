# Zewarish — Fine Jewellery Website

A single-page, cinematically animated Flask website for **Zewarish**, a fine jewellery brand focused on gold, diamonds, gemstones, bridal sets, custom keepsakes, gifting, and aftercare.

## What's in this build

The site is content-driven through `content/*.json`, with reusable sections for hero, about, stats, services, bridal jewellery, collections, pricing, offers, testimonials, team, blog, Instagram, FAQ, booking, contact, and newsletter.

It also includes:

- `/admin` password login
- consultation request list with status changes
- newsletter subscriber list
- JSON exports for requests and subscribers
- `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/healthz`
- Zewarish favicon and OpenGraph SVG assets in `static/images/`

## Run it

```bash
pip install -r requirements.txt --break-system-packages
python app.py
# visit http://localhost:5000
```

This checkout already has a virtualenv at `.newvenv`, so this also works:

```bash
.newvenv/bin/python app.py
```

If port 5000 is busy:

```bash
PORT=5001 .newvenv/bin/python app.py
```

Admin login:

```text
http://localhost:5000/admin
default password: admin123
```

Set `ADMIN_PASSWORD` and `SECRET_KEY` in the environment before deploying.

## Content Model

Every visible brand detail lives in JSON:

```text
content/business.json      Brand name, contact, hours, location, ratings
content/seo.json           Meta title, description, keywords, schema type
content/navigation.json    Logo text, nav links, CTA
content/homepage.json      Hero, about, stats, why-choose, newsletter
content/services.json      Jewellery categories and bridal packages
content/gallery.json       Collection filters and swatch cards
content/pricing.json       Starting ranges and inclusions
content/offers.json        Seasonal offers
content/testimonials.json  Reviews and Google rating summary
content/team.json          Advisors and craft leads
content/blog.json          Jewellery journal cards
content/theme.json         Brand palette, fonts, spacing, shadows
```

## Design Direction

Zewarish uses a warm jewellery palette: deep ink, bordeaux, antique gold, ivory, and soft blush, with Cormorant Garamond for the display voice and Manrope for interface text. The placeholder collection art uses jewel-toned swatches until real product photography is added.

## Suggested Next Phases

1. Add real jewellery photography with WebP, lazy loading, and responsive `srcset`.
2. Rename internal booking fields from legacy `appointment/stylist` wording to `consultation/advisor` if backward compatibility with existing JSON data is not needed.
3. Move requests from JSON files to a database for production use.
4. Add email/SMS/WhatsApp confirmations for consultation requests.
