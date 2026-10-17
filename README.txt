SHRINK RUN - game files for Poki and CrazyGames
================================================

poki/index.html          the Poki version
crazygames/index.html    the CrazyGames version

Each one is a single self-contained file: the game, three.js, the fonts and all
sound are inside it. The only thing it loads from the internet is that portal's
own SDK script (the portals require this).

TO UPLOAD
- Open the folder for the portal, select index.html, and zip it so that
  index.html sits at the top level of the zip (not inside another folder).
- Poki: upload the zip in Poki for Developers and test it in the Inspector.
  On phones Poki draws a small menu button at the top; the game moves its top
  menu over to make room, so check that in the Inspector.
- CrazyGames: in the submission form, under "Does your game save progress?",
  choose the option for using the Data Module from the CrazyGames SDK. Signed-in
  players' progress is saved to their CrazyGames account through it.

SAVING
- Progress is saved on the player's device after every change (IndexedDB, not
  localStorage), and also when the tab is hidden or closed.
- If a browser blocks storage completely, the game still works and tells the
  player that progress will be lost when the tab closes.
- No browser can keep anything after a private/incognito window is closed. Saving
  works for as long as the window is open.
- Each player has their own save. New players start from zero. Signed-in Poki or
  CrazyGames players only ever see their own account's progress.

ADS
- An ad break after every finished run (when the player taps Run again or Main
  menu). The portal decides whether each break actually shows an ad.
- A "watch an ad for a reward" popup every few runs (3,000 coins, or sometimes a
  free Lucky Spin). The reward is only given after the ad finishes, and it only
  plays if the player taps the button.
