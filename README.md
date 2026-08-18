# Market Mastery

Build a full-stack Warframe Market Scanner web app for me. Goal: answer questions like 'what are people buying right now that I can realistically farm and sell for the highest platinum per hour?' Use the public Warframe.Market API, not scraping. Respect API rate limits and cache aggressively. No login is required for read-only market analysis.

Core features for v1:
1) Dashboard with a ranked table of current farming opportunities. Columns: item, category, highest active buy price, lowest active sell price, spread, number of active buyers, number of active sellers, recent order activity/liquidity proxy, estimated farm time, estimated plat/hour, vault/resurgence status if known, and recommendation: FARM / SELL NOW / HOLD / SKIP.
2) Search any item, including Prime sets/parts, mods, Rivens where supported, and show live/top buy and sell orders, recent activity, price stats and a short interpretation.
3) A 'What should I farm now?' page that ranks only realistically farmable things and excludes nonsense such as cosmetics or items the API shows but players cannot farm directly. Allow filters for activity type: Void Fissures/Prime parts, Corrupted Mods, Rivens, Syndicate mods, Kuva/Requiem, etc.
4) A 'My Inventory' page where I can manually enter quantities of Prime parts/mods/sets I own. Rank what I should sell now, what sets I can complete cheaply, and what I should hold because it is vaulted/temporarily scarce. Persist locally for now.
5) A 'Riven lottery' page that explains and ranks unveiled Rivens by weapon demand. Do not pretend to know exact riven roll value from normal item orders; clearly separate normal market data from Riven auction data if the API supports auctions.
6) Item detail page with top online buyers/sellers, median/weighted recent price where available, historical trend chart if API supports it, and direct link out to the Warframe.Market item page.
7) Calculations: create a transparent opportunity score based on plat value, active demand/liquidity, spread, and user-editable expected farm time. Show the formula/inputs so it is not a black box. Plat/hour should use user-editable farm-time estimates when no reliable drop-time model exists.
8) Data freshness: visible 'last updated' timestamps, retry/backoff, clear error states, and avoid hammering the API. Respect roughly 3 requests/sec maximum and preferably stay below it.
9) UK locale and dark UI inspired by Warframe but do not copy copyrighted artwork/assets. Clean futuristic dashboard, mobile friendly.
10) Add a 'Quick sell targets' section geared toward a player with only a small amount of tradable Platinum who wants to get to 100p quickly.

Important correctness constraints:
- Never invent live prices if the API call fails.
- Clearly distinguish BUY orders (what someone will pay me now) from SELL orders (what sellers are asking).
- Clearly distinguish a complete Prime set from individual components.
- Explain Vault/Prime Resurgence status only if sourced reliably; otherwise show 'unknown' rather than guessing.
- Use Warframe.Market API v2/public docs and the current API response structure. If CORS prevents direct browser calls, proxy through the app backend/serverless functions.
- Build sensible server-side caching so bulk analysis is possible without violating rate limits.

Seed the app with these watchlist items because they matter to me: Vauban Prime Set, Zephyr Prime Set, Yareli Prime Blueprint, Torid, Dual Toxocyst, Malignant Force, Transient Fortitude, Blind Rage, Narrow Minded, Overextended, Fleeting Expertise.

For v1, if exact automated drop/farm-time data is unavailable, include an editable farm-time estimate table with reasonable placeholder defaults clearly labelled as user estimates, not facts. Architecture should make it easy to add official/wiki drop-table data later.

Build the working app now, not just a mockup.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://warframe-market-scanner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/046dd331-ed99-4618-8bd1-f0c8a917ec1f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
