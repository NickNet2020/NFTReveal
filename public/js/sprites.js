// ═══════════════════════════════════════════════════════════════════
//  SPRITES.JS - 8-Bit Pixel Art Sprite Definitions
//  Each sprite is defined as an array of strings where each char
//  maps to a color in the palette. '.' = transparent.
// ═══════════════════════════════════════════════════════════════════

const Sprites = (() => {

  // ─── Sprite Cache ────────────────────────────────────────────
  const cache = {};

  // ─── Render sprite data to an offscreen canvas ───────────────
  function renderSprite(data, palette, scale = 3) {
    const key = JSON.stringify({ data, palette, scale });
    if (cache[key]) return cache[key];

    const h = data.length;
    const w = data[0].length;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = data[y][x];
        if (ch === '.' || !palette[ch]) continue;
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }

    cache[key] = canvas;
    return canvas;
  }

  // ─── Colorize a sprite (replace team color) ──────────────────
  function renderColorized(data, palette, teamColor, scale = 3) {
    const key = JSON.stringify({ data, palette, teamColor, scale });
    if (cache[key]) return cache[key];

    const modPalette = { ...palette, 'T': teamColor };
    return renderSprite(data, modPalette, scale);
  }

  // ─── PLAYER SPRITE (16x18) ──────────────────────────────────
  const PLAYER_PALETTE = {
    'h': '#d4a574', // skin
    'H': '#c49464', // skin shadow
    'e': '#2c1810', // eyes
    'b': '#4a3728', // hair
    'B': '#3a2718', // hair dark
    'T': '#e74c3c', // team color (replaced)
    't': '#c0392b', // team dark
    'p': '#6b4423', // pants
    'P': '#5a3413', // pants dark
    's': '#8b8b8b', // sword
    'S': '#aaaaaa', // sword bright
    'g': '#f1c40f', // gold trim
    'c': '#d4a017', // cape
  };

  const PLAYER_DATA = [
    '......bbbb......',
    '.....bBBBBb.....',
    '....bBBBBBBb....',
    '....bhhhhhhb....',
    '....hheehheH....',
    '....hhhhhhHH....',
    '....hHhhhHH.....',
    '.....hhhhhH.....',
    '....gTTTTTg.....',
    '...TTTTTTTTT....',
    '...TTTTTTTTTc...',
    '...tTThhtTTtc...',
    '....thhhht.cc...',
    '....thhhhht.....',
    '....thhhht......',
    '.....pppp.......',
    '....pP..pP......',
    '....pp..pp......',
  ];

  // ─── PLAYER WITH CROWN (for high level) ─────────────────────
  const PLAYER_CROWN_DATA = [
    '....g.gg.g......',
    '....gggggg......',
    '....gfggfg......',
    '......bbbb......',
    '.....bBBBBb.....',
    '....bBBBBBBb....',
    '....bhhhhhhb....',
    '....hheehheH....',
    '....hhhhhhHH....',
    '....hHhhhHH.....',
    '.....hhhhhH.....',
    '....gTTTTTg.....',
    '...TTTTTTTTT....',
    '...TTTTTTTTTc...',
    '...tTThhtTTtc...',
    '....thhhht.cc...',
    '....thhhhht.....',
    '....thhhht......',
    '.....pppp.......',
    '....pP..pP......',
    '....pp..pp......',
  ];

  const PLAYER_CROWN_PALETTE = { ...PLAYER_PALETTE, 'f': '#e74c3c' };

  // ─── FOOT SOLDIER (12x14) ──────────────────────────────────
  const SOLDIER_PALETTE = {
    'h': '#d4a574', // skin
    'H': '#c49464', // skin shadow
    'e': '#2c1810', // eyes
    'a': '#8b8b8b', // armor
    'A': '#6b6b6b', // armor dark
    'T': '#e74c3c', // team (replaced)
    's': '#aaaaaa', // sword
    'S': '#cccccc', // sword bright
    'p': '#6b4423', // pants
    'g': '#f1c40f', // gold accent
    'l': '#555555', // helmet
    'L': '#444444', // helmet dark
  };

  const SOLDIER_DATA = [
    '....llll....',
    '...lLLLLl...',
    '...lhhhhl...',
    '...hheehh...',
    '...hhhhhH...',
    '....hhhh....',
    '...gaaag.S..',
    '..TaaaaaTS..',
    '..TaTTaTT...',
    '..TaTTaTT...',
    '...ahha....',
    '...phhp....',
    '...p..p....',
    '...pp.pp...',
  ];

  // ─── HORSE KNIGHT (16x16) ──────────────────────────────────
  const HORSE_PALETTE = {
    'h': '#d4a574', // rider skin
    'e': '#2c1810', // eyes
    'a': '#8b8b8b', // armor
    'A': '#6b6b6b', // armor shadow
    'T': '#e74c3c', // team
    'g': '#f1c40f', // gold
    'l': '#555555', // helmet
    'H': '#8b6914', // horse body
    'D': '#6b4914', // horse dark
    'M': '#3a2a0a', // mane
    'w': '#ffffff', // eye white
    'b': '#2c1810', // horse eye
    's': '#aaaaaa', // spear
    'S': '#cccccc', // spear tip
  };

  const HORSE_DATA = [
    '.....ll.........',
    '....laal..S.....',
    '....hahh..S.....',
    '....hehh..s.....',
    '....hhh..ss.....',
    '...gTTTgs.......',
    '...TTTaTT.......',
    '..MMDD..........',
    '.MDDHHHDb.......',
    '.MHHHHHHHw......',
    '.MHHHHHHHHHD....',
    '..DHHHHHHHHD....',
    '..DHHHHHHHD.....',
    '..DH.DH.HD.....',
    '..DD.DD.DD.....',
    '..D..D..DD.....',
  ];

  // ─── WIZARD (14x16) ────────────────────────────────────────
  const WIZARD_PALETTE = {
    'h': '#d4a574', // skin
    'e': '#2c1810', // eyes
    'T': '#e74c3c', // team robe
    't': '#c0392b', // robe dark
    'r': '#9b59b6', // robe accent
    'R': '#8e44ad', // robe dark accent
    'g': '#f1c40f', // gold
    'w': '#ffffff', // beard/hat
    'W': '#dddddd', // beard shadow
    's': '#8b4513', // staff
    'o': '#3498db', // orb
    'O': '#2980b9', // orb dark
    'p': '#6b4423', // boots
    '*': '#00bcd4', // magic sparkle
  };

  const WIZARD_DATA = [
    '....*rr.........',
    '....rRr.........',
    '...rRRRr........',
    '..rRRRRRr.......',
    '..rwwhhwr.......',
    '..whheehw.......',
    '...wwwww........',
    '..wwwwwww.......',
    '..gTTTTTg..s....',
    '.TTTTTTTTTss....',
    '.tTTTTTTTtso....',
    '.tTTTTTTTtsoO...',
    '..tTTTTTt.so....',
    '...ttttt..s.....',
    '...pp.pp........',
    '...pp.pp........',
  ];

  // ─── DRAGON (20x16) ────────────────────────────────────────
  const DRAGON_PALETTE = {
    'T': '#e74c3c', // team main
    't': '#c0392b', // team dark
    'd': '#922b21', // darkest
    'w': '#e8d44d', // wing membrane
    'W': '#d4c030', // wing dark
    'e': '#f1c40f', // eye
    'E': '#ff6600', // eye pupil
    'f': '#ff4400', // fire
    'F': '#ff8800', // fire bright
    'c': '#333333', // claws
    'h': '#bbb', // horn
    'n': '#fff', // nostril smoke
    '*': '#ff0', // sparkle
  };

  const DRAGON_DATA = [
    '..h.............h......',
    '..hT...........Th......',
    '..TTT.........TTT......',
    '.TTTT...wWw...TTTT.....',
    '.TTTTeEwWWWw.eTTTT.....',
    '..TTTTTwWWWwTTTTT......',
    '...TTTTTwwwTTTTT.......',
    '....TTTTTTTTTTT........',
    '...tTTTTTTTTTTTt.......',
    '...tTTTTTTTTTTt........',
    '....tTTTTTTTTt.........',
    '.....tTTTTTTt..........',
    '....c.tTTTt.c..........',
    '....c..ttt..c..........',
    '....c.......c..........',
    '.....c.....c...........',
  ];

  // ─── GOLD COIN (8x8) ──────────────────────────────────────
  const COIN_PALETTE = {
    'g': '#f1c40f', // gold
    'G': '#d4a017', // gold dark
    'b': '#b8860b', // gold darkest
    's': '#ffe066', // shine
  };

  const COIN_FRAMES = [
    [ // Frame 0
      '..gGGg..',
      '.gssGGg.',
      'gssgGGGg',
      'gsgGGGGg',
      'ggGGGGGg',
      'gGGGGGbg',
      '.gGGGgb.',
      '..gggb..',
    ],
    [ // Frame 1 (narrower)
      '...gg...',
      '..gsGg..',
      '.gssGGg.',
      '.gsGGGg.',
      '.gGGGGg.',
      '.gGGGbg.',
      '..gGgb..',
      '...gg...',
    ],
    [ // Frame 2 (thin)
      '...gg...',
      '...sg...',
      '...sg...',
      '...Gg...',
      '...Gg...',
      '...Gg...',
      '...gb...',
      '...gb...',
    ],
  ];

  // ─── HOUSE (14x14) ─────────────────────────────────────────
  const HOUSE_PALETTE = {
    'r': '#c0392b', // roof
    'R': '#962d22', // roof dark
    'w': '#d2b48c', // wall
    'W': '#b8956a', // wall dark
    'd': '#6b4423', // door
    'D': '#4a2f13', // door dark
    'n': '#2c1810', // window
    'g': '#f1c40f', // chimney glow
    'c': '#8b8b8b', // chimney
    'C': '#6b6b6b', // chimney dark
    'b': '#555', // base
    's': '#aaa', // smoke
    'T': '#e74c3c', // team flag
  };

  const HOUSE_DATA = [
    '...s..cc........',
    '......cC...T....',
    '...rrrcCrrrrr...',
    '..rrRrrrrRrrrr..',
    '.rrRRrrrrrRRrrr.',
    'rrRRRrrrrrRRRrrr',
    '.wWwwwnwwnwwWw..',
    '.wWwwwnwwnwwWw..',
    '.wWwwwwwwwwwWw..',
    '.wWwwwnwwnwwWw..',
    '.wWwwwnwwnwwWw..',
    '.wWwwdddddwwWw..',
    '.wWwwdDDDdwwWw..',
    '.bbbbbbbbbbbbb..',
  ];

  // ─── GOLD MINE (14x12) ─────────────────────────────────────
  const GOLDMINE_PALETTE = {
    'w': '#8b7355', // wood
    'W': '#6b5335', // wood dark
    'd': '#555', // dark
    'g': '#f1c40f', // gold
    'G': '#d4a017', // gold dark
    'r': '#6b4423', // rock
    'R': '#4a2f13', // rock dark
    'b': '#333', // base
    'T': '#e74c3c', // team
    's': '#aaaaaa', // support
    'o': '#ffe066', // ore sparkle
    'c': '#8b8b8b', // chain
  };

  const GOLDMINE_DATA = [
    '......ss........',
    '.....sWWs.......',
    '....sWddWs......',
    '...sWddddWs.....',
    '..wwwwwwwwww....',
    '..wrrgGogrRw....',
    '..wRrgGggrRw....',
    '..wRrrrrrrRw....',
    '..wrrgGogrRw....',
    '..wRrgGggrRw....',
    '..WWWWWWWWWW....',
    '..bbbbbbbbbb....',
  ];

  // ─── TREE SPRITES (3 variants) ─────────────────────────────
  const TREE_PALETTE = {
    'l': '#27ae60', // leaves
    'L': '#1e8449', // leaves dark
    'D': '#145a32', // leaves darkest
    't': '#8b6914', // trunk
    'T': '#6b4914', // trunk dark
    's': '#2ecc71', // leaves bright
  };

  const TREE_VARIANTS = [
    [ // Pine tree
      '......l......',
      '.....lsl.....',
      '....llsll....',
      '...lllslll...',
      '..LlllsllLl..',
      '.LLllllllLL..',
      'LLLllllllLLL.',
      '.DLLlllllLD..',
      '..DLLlllLD...',
      '...DLLLLLD...',
      '....DttD.....',
      '.....tT......',
      '.....tT......',
    ],
    [ // Round tree
      '....lllll....',
      '..llslslll...',
      '.llslllslll..',
      'lllllllllll..',
      'llLlllllLll..',
      '.LLlllllLL...',
      '..LLlllLL....',
      '...DLLLD.....',
      '.....tT......',
      '.....tT......',
      '.....tT......',
    ],
    [ // Bushy tree
      '...llllll....',
      '..lsllslll...',
      '.lsllllslll..',
      'llllllllllll.',
      'lllLllllLlll.',
      'llLLlllllLll.',
      '.LLLlllllLL..',
      '..DLLLLLLLD..',
      '....DttD.....',
      '.....tT......',
      '.....tT......',
      '.....tT......',
    ],
  ];

  // ─── ROCK SPRITES (3 variants) ─────────────────────────────
  const ROCK_PALETTE = {
    'r': '#95a5a6', // rock
    'R': '#7f8c8d', // rock mid
    'd': '#6b7b7c', // rock dark
    'D': '#566666', // rock darkest
    's': '#bdc3c7', // rock highlight
  };

  const ROCK_VARIANTS = [
    [
      '...rrr...',
      '..rsRRr..',
      '.rssRRRr.',
      '.rRRRRDr.',
      '.rRRRDDr.',
      '..dDDDd..',
    ],
    [
      '..rr.....',
      '.rsRr.rr.',
      'rsRRrrRRr',
      'rRRRRRRDr',
      '.rRDDDDr.',
      '..dddd...',
    ],
    [
      '....rrr..',
      '...rsRRr.',
      '..rsRRRr.',
      '.rRRRDDr.',
      '.rDDDDd..',
      '..ddd....',
    ],
  ];

  // ─── FIRE EFFECT (for dragons) ─────────────────────────────
  const FIRE_PALETTE = {
    'f': '#ff4400',
    'F': '#ff8800',
    'y': '#ffcc00',
    'Y': '#ffee44',
    'r': '#cc2200',
  };

  const FIRE_FRAMES = [
    [
      '..y..',
      '.yFy.',
      '.FfF.',
      'FffFr',
      'rffrr',
    ],
    [
      '.y...',
      'yFy..',
      '.Ffy.',
      'rFfF.',
      'rrffr',
    ],
  ];

  // ─── MAGIC ORB (for wizard projectile) ─────────────────────
  const MAGIC_PALETTE = {
    'o': '#9b59b6',
    'O': '#8e44ad',
    'b': '#3498db',
    'B': '#2980b9',
    's': '#e8d8f8',
    '*': '#fff',
  };

  const MAGIC_DATA = [
    '.oOo.',
    'osBOo',
    'OsbBO',
    'oBBBo',
    '.oOo.',
  ];

  // ─── AURA EFFECT ───────────────────────────────────────────
  // Auras are drawn procedurally, not as sprites

  // ─── Skull (death marker) ──────────────────────────────────
  const SKULL_PALETTE = {
    'w': '#ffffff',
    'W': '#dddddd',
    'b': '#222222',
    'g': '#888888',
  };

  const SKULL_DATA = [
    '..wwww..',
    '.wWWWWw.',
    'wWbWWbWw',
    'wWWWWWWw',
    '.wWgWgw.',
    '..wWWw..',
    '..gbgb..',
  ];

  // ─── Pre-render and return API ──────────────────────────────
  return {
    renderSprite,
    renderColorized,
    PLAYER_PALETTE, PLAYER_DATA,
    PLAYER_CROWN_DATA, PLAYER_CROWN_PALETTE,
    SOLDIER_PALETTE, SOLDIER_DATA,
    HORSE_PALETTE, HORSE_DATA,
    WIZARD_PALETTE, WIZARD_DATA,
    DRAGON_PALETTE, DRAGON_DATA,
    COIN_PALETTE, COIN_FRAMES,
    HOUSE_PALETTE, HOUSE_DATA,
    GOLDMINE_PALETTE, GOLDMINE_DATA,
    TREE_PALETTE, TREE_VARIANTS,
    ROCK_PALETTE, ROCK_VARIANTS,
    FIRE_PALETTE, FIRE_FRAMES,
    MAGIC_PALETTE, MAGIC_DATA,
    SKULL_PALETTE, SKULL_DATA,
  };
})();
