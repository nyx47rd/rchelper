<div align="right">

[![🇹🇷 Türkçe](https://img.shields.io/badge/🇹🇷-Türkçe-E30A17?style=flat-square)](README.tr.md)

</div>

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=0,2,2,5,30&height=220&section=header&text=RC%20Helper&fontSize=80&fontColor=ffffff&fontAlignY=45&animation=twinkling&desc=RollerCoin%20Power%20Automation&descAlignY=65&descSize=18&descColor=ffffff" width="100%"/>

<img src="favicon.ico" width="48" height="48" alt="RC Helper Icon"/>

</div>

<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=700&size=22&pause=1200&color=FF3D6B&center=true&vCenter=true&width=600&lines=Auto+game+selector+%E2%86%92+more+power;Power+collection+automation;Customizable+break+reminder;Game+stats+%26+live+widget;Easy+start+with+interactive+tutorial;Full+control+with+keyboard+shortcuts;Hands-free+with+Auto-Play;Smart+game+skip+system" alt="Typing SVG" />

<br/><br/>

[![Manifest](https://img.shields.io/badge/Manifest-v3-FF3D6B?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-34D399?style=for-the-badge&logoColor=white)](LICENSE)
[![Stars](https://img.shields.io/github/stars/nyx47rd/rchelper?style=for-the-badge&color=FF3D6B&logo=github)](https://github.com/nyx47rd/rchelper/stargazers)

<br/>

![Profile Views](https://komarev.com/ghpvc/?username=nyx47rd&label=Repo+Views&color=FF3D6B&style=for-the-badge)
[![GitHub last commit](https://img.shields.io/github/last-commit/nyx47rd/rchelper?style=for-the-badge&color=FF3D6B&logo=github)](https://github.com/nyx47rd/rchelper/commits)
[![GitHub release](https://img.shields.io/github/v/release/nyx47rd/rchelper?style=for-the-badge&color=FF3D6B&logo=github)](https://github.com/nyx47rd/rchelper/releases/latest)

</div>

---

## 🚀 What is it?

**RC Helper** is an open-source Chrome extension developed for the [RollerCoin](https://rollercoin.com) platform, providing game automation and power collection convenience (**RollerCoin Helper & Bot**). It does not **play** the games robotically for you — instead, it automatically selects and starts the most suitable game on the game selection screen, and automatically harvests your power (*Gain Power*) when the game is over.

This tool acts as a safe RollerCoin assistant, auto game selector, automatic power collector (*auto collect*), and smart break reminder.

> ⚠️ **Important:** RC Helper is not a cheat or hack tool. It only automates the game *selection* and *collection* processes to save you time and does not violate RollerCoin rules.

<br/>

---

## ✨ Features

<div align="center">

|⚡ Feature |📖 Description |
|:---:|:---|
|🎮 **Auto Select Game** |Randomly selects a non-skipped game, presses the button and starts it.
|💰 **Auto Collect** |Automatically presses the *Gain Power* and *Collect* buttons that appear when the game is over |
|⏸ **Pass** |Skips the selected game for **10 minutes**;automatically returns to the list when time expires |
|🚫 **Always Skip** |**Permanently** blocks the game;will never be selected again |
|📋 **Manage from List** |See all games from the popup and add/remove them to the pass or always skip list with one click |
|☕ **Break Reminder** |At the end of the specified time, the full-screen break timer opens;continues automatically after it finishes |
|⚙️ **Break Settings** |Set game duration (1–120 min) and break time (0.5–60 min) freely from popup |
|📊 **Statistics** |Total/daily/weekly number of games, total time, avg.duration, most played and more |
|🎯 **Now Playing** |The name of the active game and the session counter are displayed live on the widget |
|📈 **Hourly Forecast** |With the EMA algorithm, it predicts how many games you will play per hour based on your current speed |
|🛡️ **Update Protection** |In the old version, auto-play is automatically blocked;popup shows update alert |
|🎓 **Interactive Tutorial** |11-step tour with spotlight on first boot;It can be reopened whenever you want with the `?` button |
|⌨️ **Keyboard Shortcuts** |`S` = Pass · `P` = Always Skip |
|🔊 **Sound Effects** |Different tones for play selection, passing, timeout start/end, automation on/off |
|🗑️ **Clear Memory** |Reset all settings and statistics with one button |
|🤖 **Game Bots** |Auto-play Coin Fisher, Hamster Climber & 2048 Coins when fullscreen. Toggle each bot individually from popup. |

</div>

<br/>

---

## 📦 Installation

### Step 1 — Download Files

[![Download ZIP](https://img.shields.io/badge/⬇_INSTALL_LATEST_VERSION-FF3D6B?style=for-the-badge)](https://github.com/nyx47rd/rchelper/releases/latest)

Download the `rchelper-vX.X.X.zip` file from the Releases page and extract it to a folder.

---

### Step 2 — Install on Chrome

1. Type `chrome://extensions` in the address bar
2. Turn on **Developer Mode** from the top right corner
3. Press the **"Load unpackaged item"** button
4. Select the `rchelper` folder you extracted
5. ✅ If **RC Helper** appears in the list, the installation is complete

---

### Step 3 — Get Started

1. Go to [rollercoin.com](https://rollercoin.com)
2. Click on the plugin icon in the upper right corner
3. **interactive tutorial** starts automatically at first startup
4. Press the **Auto-Play: OFF** button → **Auto-Play: ON** 🟢

> Live statistics widget appears at the top left of the page.

<br/>

---

## 🖥️ Popup Panel

The popup that opens when the plugin icon is clicked is a 256px wide control panel.Sections:

|Section |Content |
|:---|:---|
|**Title** |RC Helper logo, version information, `?` tutorial button |
|**Update Banner** |If there is a new version, it will be shown automatically, includes a download link |
|**Settings** |Auto Select / Auto Collect / Break Reminder toggles |
|**Break Settings** |Game time and break time numerical inputs |
|**Game Bots** |Toggle Coin Fisher / Hamster Climber / 2048 Coins auto-play individually. Active bots show "PLAYING" badge. |
|**Select from List** |Panel listing all known games (with Pass / Always Skip button) |
|**Pass / Always / List** |Quick action buttons |
|**Auto-Play** |Main on/off button |
|**Missed · 10min** |Temporarily skipped games and remaining times |
|**Always Skipt** |Permanent block list — can be removed with the X button |
|**Statistics** |9 metric stats card + reset button |
|**Clear Memory** |Clears all `chrome.storage.local` data |

<br/>

---

## 📊 In-Page Widget

A fixed card appears in the **upper left corner** of the page.Includes:

- **Session counter** — number of games played in this session
- **Time counter** — time since the beginning of the session (mm:ss)
- **Hourly prediction** — "~X games per hour" prediction based on EMA (appears after at least 3 games)
- **Break status** — remaining time if the break is active, otherwise time until the next break
- **Currently playing** — shows the name of the game when the game starts, hides it when it ends
- **Console** — shows important system messages in red

To close the widget, the upper right `✕` button can be pressed.To open it again, click on the small list icon that will appear in the corner.

<br/>

---

## ☕ Break System

When the break reminder is on, the following loop runs:

```
[Play games] ──(Session time reached)──► [Full-screen break opens]
                                                       │
                                           (Break time ends or
                                            "End Break" clicked)
                                                       │
                                                       ▼
                                              [Auto-resume]
```

A large countdown timer and an "End Break" button appear on the **Break screen**.The hourly forecast calculation automatically deducts break times.

**Break Settings** can be changed from the card in the popup:

|Setting |Default |December |
|:---|:---:|:---:|
|Game time |10 min |1 – 120 min |
|Break time |2.5 min |0.5 – 60 min |

When you change the value and exit the input, it is saved immediately and becomes valid in the active tab.

<br/>

---

## 📈 Statistics

The **Stats** card in the popup is automatically updated every 3 seconds:

|Metric |Description |
|:---|:---|
|**Total Game** |Total games of all time |
|**Today** |Number of games played per day |
|**This Week** |Total of the last 7 days |
|**Total Time** |Total time of all games |
|**Avg.Duration** |Average time per game |
|**Longest** |Longest game played in one go |
|**Most Played** |Favorite game by total number of plays |
|**Last Game** |Name of the last game played |
|**Active Day** |On how many different days were games played?
|**Currently Playing** |Instant active game (queried from content script) |

Data is stored in `chrome.storage.local`.To reset, press the 🔄 icon in the card header.

<br/>

---

## 🎓 Interactive Tutorial

It starts automatically on first installation.It can be reopened whenever you want with the **`?`** button in the popup header.

**11 steps:**

|# |Target |Topic |
|:---:|:---|:---|
|1 |— |Welcome screen |
|2 |Auto Select toggle |Game selection automation |
|3 |AutoCollect toggle |Power collection automation |
|4 |Break Reminder toggle |Break system |
|5 |Break Settings card |Duration customization |
|6 |Pass button |Temporary jump |
|7 |Always Skip button |Permanent block |
|8 |List button |Management from list |
|9 |Auto-Play button |Main control |
|10 |Game Bots card |Bot toggle management |
|11 |Statistics card |Game tracking |

At each step, the target element is highlighted with a **red spotlight**.The description box is positioned automatically and the screen scrolls to the target element.

<br/>

---

## 🛡️ Update Protection

RC Helper checks for the latest version from the GitHub API at every launch.If the version you are using is old:

- Auto-play **automatically blocked**
- An orange **update banner** appears in the popup
- ⚠️ alert shown on widget

This prevents an older version from exhibiting corrupt behavior.

<br/>

---

## ⌨️ Keyboard Shortcuts

<div align="center">

|Key |Action |Detail |
|:---:|:---|:---|
|`S` |**Pass** |Skips current game by 10 minutes |
|`P` |**Always Skip** |Permanently blocks the current game |

</div>

> Only works on `rollercoin.com` when a `input` or `textarea` is not in focus.

<br/>

---

## 🔒 Permissions

<div align="center">

|Permission |Why Necessary |
|:---:|:---|
|`activeTab` |To run script in active tab |
|`scripting` |To inject content script into the page |
|`tabs` |Popup → for cross-tab messaging |
|`storage` |To permanently save settings, statistics and skipped games |

</div>

<br/>

---

## ❓ Frequently Asked Questions

**Auto-Play does not open, what should I do?**
You are probably using an old version.If an update banner appears in the popup, download the latest version and reinstall it.

**The name of the game appears as "Game-XXXX".**
The game on the game selection page has not yet loaded name information.It will be fixed when you refresh the page.

**The game I passed is still being selected.**
The jump list is automatically cleared after 10 minutes.Use "Always Skip" if you don't want it to be selected before time runs out.

**The break screen opens too often/less often.**
Increase or decrease game time from the Popup → Break Settings card.

**Statistics reset / lost.**
The "Clear Memory" button clears the entire `chrome.storage.local`.This button should be pressed carefully.

**Widget does not appear on the page.**
Refresh the page.The plugin is installed as a content script;It may start delayed on some pages.

**Game bot doesn't start automatically.**
Make sure the bot is enabled in Popup → Game Bots card. The bot only activates when you go fullscreen.

<br/>

## 🛠️ Technology

<div align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chrome](https://img.shields.io/badge/Chrome_API-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)

</div>

<br/>

```text
📁 rchelper/
├── 📄 manifest.json           ← Extension definition (Manifest v3)
├── 📜 content.js              ← In-page automation + widget UI + break system
├── 📜 popup.js                ← Popup panel logic + stats reading
├── 🎨 popup.html              ← Popup panel UI + styles
├── 📜 i18n.js                 ← Internationalization (Multi-language) support
├── 🎓 tutorial.js             ← Interactive tutorial steps + spotlight logic
├── 🎨 tutorial.css            ← Tutorial overlay styles
├── ⚙️  background.js          ← Service worker (Manifest v3 requirement)
├── 🎮 games/                  ← Game-specific logic and auto-play scripts
└── 🖼️  icon16/48/128.png      ← Extension icons
```

**Technical highlights:**

- **URL traversal tracker** (`checkGameTransitions`) — the counter increments when the game *ends*, not when it *starts*;so that there are no false-positives in unsuccessful attempts
- Hourly forecast based on **EMA** (Exponential Moving Average) — weighted average of the last 20 games, taking into account break times
- **4-mask spotlight system** — tutorial overlay works correctly at any resolution with `position:absolute` + scroll-aware coordinate calculation
- **Update protection** — Version comparison from GitHub Releases API, auto-play blocking on old version
- **Zero dependencies** — all UI vanilla JS + inline/external CSS, no npm packages
- **Manifest v3** + Service Worker architecture

<br/>

---

## 📈 How Does It Work?

```mermaid
graph TD
    A([rollercoin.com loaded]) --> B{Page type?}
    B -->|choose_game| C[Scan game list]
    B -->|play_game| D[Wait on game screen]
    B -->|Other| B

    C --> E{Skip/Always list?}
    E -->|Yes| F[Filter and reselect]
    E -->|No| G[Random select & press button]
    F --> G

    G --> H{URL switched to play_game?}
    H -->|Yes| I[Game started: start timer]
    H -->|No| J[Wait 1.5s, retry]
    J --> G

    D --> K[Click Gain Power / Collect]
    I --> L{Returned to choose_game?}
    L -->|Yes| M[Counter +1, save stats]
    M --> N{Session time reached?}
    N -->|Yes| O[☕ Open full-screen break]
    N -->|No| B
    O --> P[Countdown — break duration]
    P --> B
```

<br/>

---

<div align="center">

### ⭐ Don't forget to star if you liked it!

[![Star](https://img.shields.io/github/stars/nyx47rd/rchelper?style=social)](https://github.com/nyx47rd/rchelper/stargazers)
[![Fork](https://img.shields.io/github/forks/nyx47rd/rchelper?style=social)](https://github.com/nyx47rd/rchelper/network/members)

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=FF3D6B&height=100&section=footer" width="100%"/>

</div>
