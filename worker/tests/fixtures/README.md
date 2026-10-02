# Image fixtures and validator scope

These nine tiny 8×8 images were generated locally from synthetic RGB pixels using Pillow 12.3.0, then decoded successfully by Pillow (every animation frame). No external image, credential or production data was used. Pillow is only the fixture-generation tool, NOT an application, Worker or test dependency. The committed bytes are sufficient to run Node/workerd tests.

Fixtures: `valid.jpg`, `progressive.jpg`, `valid.png`, `valid.webp`, `lossless.webp`, `animated.webp`, `valid.gif`, `animated.gif`, `valid.avif`. They are intentionally small; the tests check every truncated prefix, MIME mismatches, damaged lengths and missing required structures. The former inline PNG fixture had an invalid IDAT CRC and was replaced, not allowed through the validator.

The Worker validates bounded containers: JPEG frame/scan/segment boundaries and EOI, PNG chunks/CRC/IHDR/IDAT/IEND, GIF tables/frames/sub-blocks/trailer, WebP RIFF/chunks/frame headers including animation, and AVIF BMFF boxes/brands/image metadata/media presence. It does not decompress pixels, validate every codec bit, or scan for malware. Reconstructed corrupt payloads with valid container lengths can still pass; no claim of complete image decoding is made.

AVIF specifically does not resolve `iloc` item extents/references, decode AV1, or validate all HEIF/sequence semantics. The common still-image path has a real encoded fixture. The `avis` sequence-container path is limited to bounded movie/media structure and is not covered by a real animated AVIF fixture. Some unusual but valid encodings may be rejected. Test representative application images before release.

References: [PNG](https://www.w3.org/TR/png-3/), [WebP RIFF](https://developers.google.com/speed/webp/docs/riff_container), [GIF89a](https://www.w3.org/Graphics/GIF/spec-gif89a.txt), [AVIF](https://aomediacodec.github.io/av1-avif/).
