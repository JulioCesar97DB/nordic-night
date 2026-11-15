# Nordic night

A calm dark theme for the Claude desktop app: a northern night behind the conversation.

A soft green and violet aurora hangs over snowy mountains, a pine forest and a small log cabin with a lit window. Chimney smoke drifts, a few stars twinkle, and a husky sits in the snow watching the sky. A few times every couple of minutes the husky bolts across the snow and comes back to sit.

A wind blows on a scale from -5 (hard to the left) to 5 (hard to the right). It wanders slowly with the time of day, one level at a time, and it leans and drifts the aurora, bends the smoke and sways the trees; each level also gives the aurora its own length. A moon hangs in the sky where the husky is looking.

Every animation follows the clock rather than starting from zero, so when the app draws the scene again it carries on where it was instead of restarting.

The interface gets a matching palette: slate-blue night surfaces, cool white text, and the aurora's hues for accents.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install nordic-night --marketplace JulioCesar97DB/nordic-night
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```
claude plugin install nordic-night --marketplace JulioCesar97DB/nordic-night
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `JulioCesar97DB/nordic-night`, then Add plugin.

The scene is drawn by the Claude desktop and mobile apps. The terminal draws no theme.

## Changing the scene

The scene is generated. Edit `scene/build-scene.mjs` and run:

```
node scene/build-scene.mjs
```

It writes `hooks/scene.js`. Pass a file name to also save the SVG for a browser preview, and `WIND=-5` to `WIND=5` to pick the wind level of that preview. The interface colors and the glass over the scene are in `hooks/register.tsx`.

One thing worth knowing if you edit the stylesheet: the desktop app stopped animating the whole scene while its stylesheet held a universal selector rule and media queries, so it keeps to class rules and keyframes.

Check a change with `claude plugin validate .` and `claude plugin test .`.
