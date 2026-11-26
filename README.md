# MphatsoDraw 🇲🇼

**Shuffle the names. Keep the magic.**

A lightweight, mobile-first Secret Santa generator with a Malawian touch. No accounts or email required.

## Current features
- Exchange details: optional budget, currency, date, group message
- Participant names entered line-by-line or comma-separated
- Duplicate-name validation
- Odd/even participant counts supported (minimum 3)
- Mutual exclusions
- Random assignment with backtracking: no self-draws, each recipient once
- Individual reveal links, copy and WhatsApp sharing
- MWK default, Malawi-inspired visual theme and creator footer

## Privacy limitation
This prototype generates the assignment in the organiser's browser and encodes the individual assignment in each reveal URL. The organiser can technically inspect the links and anyone holding a link can open it. Encoded data is not encrypted. This is not cryptographic anonymity from the organiser. A later production privacy design should use server-side token storage or a secure draw protocol, with no public endpoint exposing all matches.

## Run
Open index.html directly in a browser. No dependencies or build process.

## Creator
O'Brien Sibande.
