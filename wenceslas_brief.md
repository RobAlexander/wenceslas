# Wenceslas: game concept

**Premise**
- Based on the Christmas carol *Good King Wenceslas*.
- You play Wenceslas.
- Your goal is to bring food to the old man.
- The game is twelve levels, called "nights".

**Presentation**
- Single-screen game.
- Pixel art at 640×360, the usual modern pixel-art resolution.
- Any colour depth is allowed, but it should still look retro.
- It snows. For now the snow is only visual and doesn't affect play.

**Obstacles**
- Trees, rocks and low stone walls.
- Only a few on each screen.
- They block Wenceslas, his pages and standard enemies. Special enemies added later might ignore them.

**Controls**
- PC: WASD to move, mouse to aim the sword, left-click to swing.
- The swing has a cooldown. Start at about 0.4 seconds and tune it in playtesting.
- Phone: twin-stick controls, as in many mobile top-down action games:
  - Drag on the left half of the screen to move, using a virtual joystick.
  - Drag on the right half to aim, and release to swing.
  - A quick tap on the right half swings at the nearest enemy.
  - Landscape orientation only.
  - Show the touch controls only on touch devices. Phone support must not compromise the PC experience.
- Gamepad, if possible: left stick to move, right stick to aim, a trigger or face button to swing. It can't be tested yet because there's no gamepad to hand, so keep the gamepad code separate and simple.

**Wenceslas**
- Has a health bar.
- Is tougher than his pages.
- The game ends if his health runs out.

**Combat**
- Your main weapon is a sword, with a big swing in front of you.
- More weapons might come later.
- Enemies are mostly robbers, with other types to be added later.
- Robbers come in from offscreen. Other enemy types may do the same.
- Robbers go for your pages by default, but will attack Wenceslas if he gets too close.
- Later nights have more enemies.

**Pages and food**
- Pages wander in from beyond the edges of the screen. You recruit one by reaching it.
- There's no limit on how many pages you can have.
- Pages follow behind you in a line, a bit like the tail in *Snake* but less rigid.
- Pages follow you whether or not they're carrying food. The usual order is: collect pages, then collect food.
- Food keeps appearing around the landscape.
- Each page carries one item of food. You need a page with empty hands to pick up food.
- Enemies can kill your pages. A page that dies drops its food where it falls, so the food can be picked up again.
- Pages never leave you unless they're killed.

**Levels**
- You lead your line of pages to the old man to deliver the food.
- The old man is in a different random spot each night.
- You finish a night by delivering a set amount of food.
- There's no time limit, but finishing quickly earns a time bonus.
- After night twelve, a partridge appears and the game ends.
- You can then start a harder version of the game, where enemies move faster.

**Scoring** (starting values, to be tuned)
- Each item of food delivered: 100 points.
- Each robber killed: 25 points.
- Time bonus: each night has a par time of 30 seconds plus 10 seconds per item of food required. You get 10 points for every whole second you finish under par.
- Hard mode: all points doubled.
- At the end of each night, a breakdown shows food, kills and time bonus separately.
- A high score table, with initials, is saved in the browser's local storage.

**Screens**
- Title screen.
- Pause menu.
- End-of-night score breakdown.
- High score table.
- Game-over screen.
- Ending, with the partridge.

**Music**
- Amiga MOD-style music, based on the traditional *Good King Wenceslas* melody.
- Don't use a MOD file player. Write a small 4-channel sample player using the Web Audio API, and store the music as pattern data in JavaScript, much as a tracker would. That makes the music adaptive, because the game controls which channels and sections are playing.
- Each night starts with just the opening phrase, played slowly and simply.
- As you get closer to the night's target, the music builds into a fuller, multi-voice arrangement. You hear the whole carol near the end of the night.
- The carol's verses don't correspond to anything in the game.
- If you don't make progress, the music keeps looping at its current stage.
- Change stages at phrase boundaries so the transitions sound musical.
- Instrument samples can be made with code, for example a bell, a choir "aah", strings, a bass and percussion. Store them as short mono samples, written to work out loud as 8-bit audio at a low sample rate, with loop points for sustained notes. CC0 recordings can be used instead (see Audio sourcing).

**Sound effects**
- Sampled, Amiga-style digital sounds rather than chiptune bleeps.
- Sounds needed, at least: sword swing, sword hit, robber killed, Wenceslas hurt, page recruited, page killed, food picked up, food dropped, food delivered, night complete, game over, partridge, and menu move and select.

**Audio sourcing**
- Prefer CC0-licensed sounds, which need no attribution. CC-BY is acceptable with credit. Don't use anything marked non-commercial (NC) or no-derivatives (ND).
- Suggested sources, in order of preference:
  1. Kenney (kenney.nl): audio packs released under CC0, such as RPG Audio, Interface Sounds and UI Audio.
  2. OpenGameArt (opengameart.org): mixed licences, so check each file.
  3. Freesound (freesound.org): filter for CC0. Searching the API needs an API key. Downloading original files needs a login, but the MP3 previews are good enough for 8-bit conversion. If an API key is provided, it will be in the environment variable `FREESOUND_API_KEY`. If not, skip Freesound.
  4. Synthesise anything that can't be found.
- Make recorded sounds sound Amiga-like with ffmpeg or SoX: mono, 8-bit, about 8–16 kHz. Ship the converted files as WAV, or OGG if file size matters. ffmpeg, SoX and Python 3 are already installed in the dev container. You can't install system packages yourself, because you don't have root.
- If a Python script needs packages from PyPI, use a virtual environment (`python3 -m venv .venv`, then install into it). Installing into the system Python is blocked. Keep `.venv` out of the deployed game.
- Keep the conversion script in the repository, so every sound can be rebuilt from its source.
- Keep a `CREDITS.md` listing every audio file with its source URL, author and licence.

**Technical**
- Plain JavaScript that runs in a web browser.
- Deploying means copying the files to a server, with no build step, so it's easy to host.
- Development-only tools, such as audio conversion scripts and a local web server, are fine as long as the shipped game doesn't depend on them.

**Automated testing (optional): Playwright**
- Use it only if the Playwright hosts below are allowed through the firewall. If they're blocked, skip it and rely on manual play-testing.
- Install it as a development dependency with npm. Install Chromium only to keep the download small, using `npx playwright install chromium`. Don't use `--with-deps`: it needs root, which you don't have in the dev container. The system libraries Chromium needs are already installed in the container image.
- Run the game from a local web server in a headless browser, and use it to:
  - catch JavaScript errors and console warnings;
  - take screenshots of each screen, to check the layout and pixel-art rendering at 640×360 and at scaled-up sizes;
  - simulate keyboard, mouse and touch input to check menus, pausing, moving between nights and the end-of-night breakdown;
  - check that high scores are saved to and read back from local storage;
  - check that sounds are triggered at the right moments. It can't judge how they sound.
- Add hooks for testing, such as a seed for random numbers or a way to jump to a given night, only if they stay out of the way of normal play.
- Playwright can't judge game feel, difficulty or music. Those need a human play-tester.
- Keep all test files out of the deployed game.

**Network allowlist for the dev container**

Required while developing:
- `api.anthropic.com`: Claude Code itself. Claude Code's reference dev container firewall already allows this and its other own hosts.
- `github.com`, `codeload.github.com`, `raw.githubusercontent.com`, `objects.githubusercontent.com`: Git, and copies of some asset packs hosted on GitHub.
- `registry.npmjs.org`: any Node development tools, such as a local server or test runner.
- `pypi.org`, `files.pythonhosted.org`: Python tools for audio scripts, if used.
- `deb.debian.org`, `security.debian.org`: the dev container's operating-system package mirrors. They're allowed for completeness, but you can't use them yourself, because you have no root access. ffmpeg, SoX and Python 3 are already installed in the container image.

For sourcing audio:
- `kenney.nl`
- `opengameart.org`
- `freesound.org`, `cdn.freesound.org`: only if an API key is provided.

For automated testing with Playwright, which is optional:
- `cdn.playwright.dev`: Playwright's main download host for browsers.
- `playwright.download.prss.microsoft.com`: Microsoft's mirror for the same files.
- `registry.npmjs.org`, already listed above, to install the Playwright package itself.
- The system libraries Chromium needs are already installed in the container image, so no OS package mirror is needed at test time.

The firewall resolves each host name to IP addresses once, when the container starts. Hosts behind a CDN, such as `cdn.playwright.dev`, can change IP addresses during a long session. If a download from an allowed host fails with a connection error, report it and ask the user to restart the container. Don't retry in a loop.

If a download fails because a host isn't on the list, stop and report the host name. Don't try to get around the firewall.
