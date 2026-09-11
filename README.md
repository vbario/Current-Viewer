# Current Viewer

An interactive electronics workbench for building and simulating DC circuits in the browser.

![Current Viewer showing a running LED circuit with live voltage and current readings](artifacts/wire-readings-desktop.png)

Current Viewer combines a visual circuit editor with a steady-state DC solver. Place components, connect their terminals, shape wires, and run the circuit to see current flow, voltage, power, heat, and component effects. Everything runs locally in the browser—there is no backend or account to set up.

## Highlights

- Build circuits from batteries, resistors, LEDs, switches, capacitors, bulbs, motors, buzzers, and breadboards.
- See live voltage and current readings on every wire while the simulation runs.
- Edit wire routes with draggable segments and bend points while endpoints stay connected.
- Simulate series and parallel branches, multiple sources, and breadboard connectivity.
- Catch source shorts and overloaded resistors or LEDs with circuit diagnostics.
- Undo and redo edits, save named circuits in the browser, and import or export JSON files.
- Use the responsive workbench on desktop and mobile.

## Getting started

You need [Node.js](https://nodejs.org/) 18 or newer.

```sh
git clone https://github.com/vbario/Current-Viewer.git
cd Current-Viewer
npm install
npm run dev
```

Open the local URL printed by Vite.

## Using the workbench

Click or drag a part from the component library to add it to the canvas. Select a part to change its value, name, rotation, or exact position.

Press `W`, then select two component terminals or breadboard holes to connect them. Select a wire to change its color or route. You can drag segments and bend points, double-click to add or remove a bend, or reset the route from the Properties panel.

Start the simulation with the Run button or the space bar. Current Viewer displays each component's electrical values and each wire's voltage relative to the first battery's negative terminal. Toggle current animation, component effects, and heat visualization from the Simulation panel.

Circuits are automatically saved to local browser storage. Use the workspace menu to keep named snapshots or move circuits between browsers as JSON files.

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `V` | Select mode |
| `W` | Wire mode |
| `H` | Pan mode |
| `Space` | Start or stop the simulation |
| `R` | Rotate the selected component |
| Arrow keys | Nudge the selected component or wire bend |
| `Shift` + arrow keys | Move a selected component farther |
| `Delete` / `Backspace` | Delete the selection |
| `Ctrl/Cmd` + `Z` | Undo |
| `Ctrl/Cmd` + `Shift` + `Z` | Redo |
| `Ctrl/Cmd` + `S` | Save a named circuit snapshot |
| `/` | Search the component library |
| `Escape` | Cancel the current action |

## Simulation model

The solver uses modified nodal analysis for steady-state DC circuits. It supports series and parallel branches, multiple voltage sources, wire networks, and breadboard connections.

Batteries include 1 Ω of internal resistance. LEDs use a piecewise-linear forward-voltage model with 10 Ω dynamic resistance. Motors and buzzers are modeled as equivalent resistive loads. Capacitors are open circuits at steady state, so charging transients and AC behavior are outside the current scope.

LED brightness follows the calculated current. Heat, motor motion, buzzer waves, and moving current dots are visual aids; they are not physical time-domain simulations.

## Development

```sh
npm run dev       # Start the Vite development server
npm run build     # Create a production build in dist/
npm run preview   # Preview the production build
npm test          # Run solver unit tests
npm run test:e2e  # Run Playwright browser tests
```

Install Playwright's browser before running the end-to-end suite for the first time:

```sh
npx playwright install chromium
```

The app is built with React, Vite, SVG, and Lucide icons. Unit tests cover the electrical model, while Playwright tests cover editing, wiring, simulation, persistence, import/export, responsive behavior, and accessibility-focused interactions.
