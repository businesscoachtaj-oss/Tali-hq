# Tali's library (10 Nov 2026)

Asked for by Taj: "her library, the books and stuff".

## What it is
A shelf of 12 real books that are out of copyright. Each night Tali loads one waiting book, reads 4 passages from the book she has read least recently, and keeps at most 4 short lessons in the shared brain (kind `knowledge`, under the part of the brain the book belongs to, `source_ref library/<book>/<passage>`). The book's own words stay on the shelf and never go into recall.

## The shelf, and how each book was checked
Checked on 10 Nov 2026 against Project Gutenberg's own record for each book (title, people and their death years, and its "Public domain in the USA" line). Australian rule used: the author and any translator or editor died before 1955.

| Book | Author | Other people | Part of the brain |
|---|---|---|---|
| How to Live on 24 Hours a Day | Arnold Bennett (d. 1931) | | Habits |
| Meditations | Marcus Aurelius (d. 180) | trans. Meric Casaubon (d. 1671) | Self-control and judgement |
| The Prince | Niccolo Machiavelli (d. 1527) | trans. W. K. Marriott (d. 1927) | Planning ahead |
| The Wealth of Nations | Adam Smith (d. 1790) | | Planning ahead |
| The Chemical History of a Candle | Michael Faraday (d. 1867) | ed. William Crookes (d. 1919) | The senses |
| The Elements of Style (1918) | William Strunk (d. 1946) | | Language |
| The Notebooks of Leonardo da Vinci | Leonardo da Vinci (d. 1519) | trans. Jean Paul Richter (d. 1937) | Vision |
| Talks to Teachers on Psychology | William James (d. 1910) | | Memory |
| The Expression of the Emotions in Man and Animals | Charles Darwin (d. 1882) | | Urgency and threat |
| An Investigation of the Laws of Thought | George Boole (d. 1864) | | The relay station |
| The Autobiography of Benjamin Franklin | Benjamin Franklin (d. 1790) | ed. Charles W. Eliot (d. 1926) | Habits |
| On the Origin of Species | Charles Darwin (d. 1882) | | Joins the two halves |

Left off on purpose:
- Health, nutrition, medicine and sports science. Old advice in those fields is often wrong and Tali must not learn it as fact.
- Sun Tzu's Art of War (the Giles translation): Lionel Giles died in 1958, so it is still in copyright in Australia.
- The Franklin edition edited by Frank Woodworth Pine: his death year is not recorded, so the Eliot edition is used.

One note: the Meditations edition has an introduction by an editor Gutenberg does not name. The translation itself is Casaubon's from 1634.

## Guard rails
- She is told to skip anything modern knowledge has overturned, any health, diet or medical advice, any money figure, any view that puts down a group of people, and contents pages and prefaces.
- Lessons are in her own words and start by naming the author. No long quotes.
- Server job only. No credits charged to anyone. Cost to us: one small AI call a night.

## Where
- Migration `20261110000068_library.sql` (applied): `brain.library_books`, `brain.library_passages`, loading and reading functions, `my_library()`, cron `tali-library` at 16:23 UTC (3:23am Sydney in summer).
- Edge function `tali-library` (deployed, version 1, verify_jwt false, x-tali-key). `{"selftest":true}` changes nothing. `{"load_only":true}` loads a book and reads nothing.
- App: `components/LibraryShelf.tsx`, `lib/library.ts`, shown on Her brain under "Use Totality too?".

## Tested for real
- Selftest: kept one lesson from a real passage and nothing from a contents page.
- First real run: loaded How to Live on 24 Hours a Day (48 passages), read 4, kept 2.

## To add a book
Insert a row into `brain.library_books` with state `queued` after checking it the same way. It loads on the next night.
