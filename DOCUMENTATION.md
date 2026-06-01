# CR Poker — Project Documentation

## Overview

CR Poker is a full-stack, browser-based Texas Hold'em poker game built as a single-player experience where a human competes against eight AI-controlled bots around a nine-seat virtual table. The game covers the complete Texas Hold'em lifecycle — dealing hole cards, advancing through the preflop, flop, turn, and river betting rounds, evaluating hands at showdown, distributing pots, and persisting player statistics across sessions. The project is divided into two independently deployed services: a React front end served through Vite, and a Node.js REST API backed by a PostgreSQL database hosted on Supabase. Players can create an account, log in with a username and password or via Google OAuth, or play immediately as a guest without any registration.

---

## The Game

The game follows standard Texas Hold'em rules. Nine seats are arranged around an oval table. The human player always occupies seat zero; the remaining eight seats belong to named bots whose personalities are modeled after famous poker players — Doyle, Phil, Daniel, Stu, Johnny, Chris, Gus, and Tom. Each player starts with 5,000 chips. Before each hand the dealer button rotates, the two players to the left of the button post the small blind (10 chips) and the big blind (20 chips), and two hole cards are dealt to every active player.

Betting proceeds clockwise through four streets. During each street a player can fold, check (if no bet is owed), call the current bet, raise to a higher amount, or go all-in. When a player goes all-in for an amount less than the full bet, a side pot is created automatically so that only players who matched the full bet can win that portion. When all remaining action is between players who are already all-in, the game auto-advances through the remaining streets without waiting for input. At showdown, each player's best five-card hand is selected from their two hole cards plus the five community cards, hands are compared, and the pot or pots are awarded accordingly. Ties split the chips. Any uncalled portion of a raise is returned to the player who made it. After each hand the chips are updated and a new hand begins automatically.

---

## Front End — React and Vite

The front end is a React 18 single-page application. React provides the declarative component model that drives all user interface state: which cards are visible, whose turn it is, what the current pot size is, and which animations are playing. The root component `App.jsx` reads authentication state from a global context and conditionally renders either the authentication screen or the game screen, so there is effectively no client-side router — just a binary switch between two top-level views.

Vite serves as the build tool and development server. During development it runs on port 5173 and proxies all `/api` requests to the Express server running on port 3001, which means the front end never has to know the server's address in development. For production the front end is built with `vite build` into a static `dist/` directory and deployed to Vercel, while a separate environment variable (`VITE_API_URL`) points the Axios client at the production backend on Render.

State inside the game lives almost entirely in `GamePage.jsx`, which holds roughly twenty pieces of `useState` — the deck, each player's cards and chip stack, the community cards, pot totals, current bets, whose turn it is, the current betting round, animation triggers, and so on. React's reconciliation engine re-renders only the parts of the UI that depend on changed state, keeping the interface responsive even when many state slices update in sequence during an automated bot turn.

---

## Authentication and Session Management — AuthContext and Supabase

Authentication state is managed by a React Context defined in `AuthContext.jsx`. When the application first loads, the context provider checks localStorage for a saved JWT token. If one is found it calls `GET /api/profile` on the back end to verify the token and restore the user object (username, chip balance, win/loss record). If the token is missing or invalid it is removed and the user is shown the login screen. Once logged in, the token and user object are saved to context so that every descendant component can read them without prop drilling.

Supabase acts as the hosted PostgreSQL database layer. The Supabase JavaScript client is initialized in `supabase.js` and used on both the client and the server. On the server it executes parameterized SQL queries against the `users`, `hand_history`, and leaderboard tables. The client also has a Supabase instance available for Google OAuth flows, where Supabase handles the OAuth redirect and returns a session that the back end then validates before issuing its own JWT.

---

## Back End — Express and Security Middleware

The server is a single Express.js file (`server/index.js`) that exposes a small REST API. Express handles routing, request parsing, and the middleware chain. Four middleware packages wrap every request before it reaches a route handler.

Helmet sets a collection of security-oriented HTTP response headers — Content Security Policy, X-Frame-Options, X-Content-Type-Options, and others — with a single function call, hardening the server against a range of common web attacks without any manual header management. CORS is configured with an explicit origin whitelist that includes the production Vercel URL and the two local Vite addresses; any request from an origin not on the list is rejected before it reaches the route logic.

`express-rate-limit` applies two separate rate limiters: authentication endpoints (register, login, Google OAuth) are capped at twenty requests per fifteen-minute window per IP address, while the stats endpoint is capped at sixty requests per minute. These limits prevent brute-force attacks and accidental flooding from a client-side bug.

Passwords are never stored in plain text. When a user registers, `bcryptjs` hashes the password with twelve salt rounds before writing it to the database. On login the submitted password is hashed and compared with `bcrypt.compare`; even if the user is not found the comparison still runs against a dummy hash, which prevents timing-based enumeration of valid usernames. Authenticated routes are protected by JSON Web Tokens issued with `jsonwebtoken`. Each token is signed with a secret stored in the server's environment variables and expires after seven days. A small middleware function verifies the token on each protected request and attaches the decoded user ID to the request object for route handlers to use.

---

## Game Logic — poker.js

The file `poker.js` contains all poker-specific logic and is entirely self-contained JavaScript with no external dependencies. `createDeck()` builds a standard 52-card deck and shuffles it with the Fisher-Yates algorithm. `evaluateHand5()` scores any five-card hand on a numeric scale from zero (high card) to eight (straight flush / royal flush) with a secondary array of kickers to break ties within the same hand rank. `bestHand()` tries all possible five-card combinations from five to seven available cards and returns the highest-scoring one. `getWinners()` applies these evaluators to every active player's hole cards plus the community cards, returns a list of winners (handling multi-way ties), and is the function called at showdown to determine pot allocation.

Bot decision-making lives in `getAIAction()`. Each of the eight bots is defined in `BOT_PERSONALITIES` as a record of aggression, bluffing tendency, and tightness values. At each decision point the bot evaluates its hole cards and community cards using `bestHand()`, translates that score into a rough hand-strength category, and then picks an action (fold, call, or raise) weighted by its personality sliders, the current pot odds, and a random factor to add unpredictability. Tighter bots fold more often with weak hands; more aggressive bots raise and re-raise at higher frequencies; bluff-prone bots occasionally bet strong regardless of their actual hand strength.

---

## Sound — Web Audio API (useSounds.js)

Sound effects are synthesized in real time using the browser's built-in Web Audio API rather than loading audio files. The `useSounds.js` hook creates an `AudioContext` on demand and programmatically constructs short waveforms for four events: dealing cards (a high-frequency swish followed by a snap), chip clicks (a short oscillator burst with exponential decay to mimic clay chips), a cascade of chip sounds for winning a pot, and a low thud with a noise layer for folding. This approach keeps the bundle small — there are no audio asset files at all — and the sounds still feel responsive because synthesis has no network latency.

---

## 3D Infrastructure — Three.js, React Three Fiber, and Drei

Three.js is the WebGL rendering library included in the project to provide 3D scene capabilities. React Three Fiber (often abbreviated R3F) is a React renderer for Three.js; it lets you declare Three.js objects as JSX elements inside a `<Canvas>` component and updates the scene graph through React's reconciliation system rather than imperative Three.js API calls. Drei is a helper library built on top of React Three Fiber that provides pre-built abstractions — camera controls, environment lighting, geometry helpers, and more — so common 3D tasks do not require writing raw Three.js code.

In the current version of CR Poker the primary table and card display are rendered with HTML and CSS rather than inside a Three.js canvas. The `PokerScene.jsx` component that houses the R3F `<Canvas>` is present in the source tree but not mounted in the active render tree. The `TableView.jsx` component builds the oval table, seat positions, card displays, and chip stacks using standard DOM elements and CSS, because HTML rendering is easier to style responsively and to overlay with UI elements like action buttons and chip counts. The Three.js, R3F, and Drei packages remain in `package.json` and `poker.js` contains a `createCardTexture()` utility that draws card faces onto a Canvas element for use as Three.js textures, indicating that a 3D table view was either previously active or planned. The infrastructure is in place to activate it.

---

## HTTP Communication — Axios

`api.js` wraps all client-to-server communication using Axios. Axios provides a promise-based HTTP client with a clean configuration API. The module reads `VITE_API_URL` from Vite's environment variable injection at build time to determine the base URL. It automatically attaches the user's JWT token as a `Bearer` Authorization header on every request if one is stored in localStorage, so individual call sites do not need to manage authentication headers manually. The four exposed functions — `register`, `login`, `getProfile`, and `updateStats` — map directly to the four server routes that require user identity. The `getLeaderboard` function requires no auth and simply fetches the ranked list of top players.

---

## Chip Animations — ChipAnimationLayer

`ChipAnimationLayer.jsx` handles the visual effect of chips flying from the pot position to the winning player's seat at the end of a hand. It receives events from `GamePage` whenever a pot is awarded and renders absolutely positioned chip icons that animate along a calculated path using CSS keyframe transitions. A `ResizeObserver` watches the container element and recalculates seat positions when the browser window changes size, keeping the animation endpoints accurate on any screen. This is a presentational-only component with no game-state side effects; it reads positions and fires animations, nothing more.

---

## Styling

All visual styling is written in a single global CSS file (`index.css`, approximately 35,000 bytes). There is no CSS preprocessor or utility framework like Tailwind in use on this project. The color palette centers on a dark green and charcoal background evoking a felt poker table, with gold accents (`#d4af37`) for text and interactive elements. Two Google Fonts are loaded in `index.html`: Cinzel, a serif typeface with a classical engraved feel used for card labels and titles, and Inter, a neutral sans-serif used for numbers and informational text. Animations — card deals with staggered timing, chip slides, seat highlights — are all CSS transitions and `@keyframes` blocks, keeping animation logic out of JavaScript where possible.

---

## Deployment Architecture

The project uses a split-deployment model. The client is deployed to Vercel, which serves the static Vite build output from its global CDN and handles HTTPS termination. The server is deployed to Render, which runs the Node.js process continuously and exposes it at a stable HTTPS URL. The Vercel deployment sets `VITE_API_URL` to the Render URL so that Axios points at the right backend in production. Both services connect to the same Supabase project for the database, and the server stores its database URL, JWT secret, and any OAuth credentials in Render's environment variable configuration rather than in the repository. The `start.sh` script at the project root starts both processes locally in parallel for development, and the Vite proxy config handles cross-origin requests in that environment so no CORS issues arise during local work.
