# World map source

`world-countries-110m.geojson` is generated from Natural Earth's
`ne_110m_admin_0_countries.geojson` dataset.

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson
- Terms: https://www.naturalearthdata.com/about/terms-of-use/
- License: public domain

The preparation script keeps the published country geometry, ISO alpha-2 code,
English name, and Natural Earth label coordinates, while removing unrelated
attributes and reducing coordinate precision for the web.
