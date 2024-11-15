# Serious Immersion: Half-Life 2

**Serious Immersion: Half-Life 2** is the very first mod in the **Serious Immersion** series that tries to recreate the atmosphere of **Half-Life 2** game by adding weapons, enemies, interface and a lot of other features ported directly from the original game.

Based on [Serious Engine 1 Mod SDK](https://github.com/DreamyCecil/SE1-ModSDK) and utilizes a [custom Entity Class Compiler](https://github.com/DreamyCecil/SE1-ECC) (`Sources/Extras/Ecc.exe`).

# Building

Building instructions are available here: https://github.com/DreamyCecil/SE1-ModSDK/wiki/Building

### Building Open Dynamics Engine library
1. Run `Sources/ode_double_opcode_x86.bat` or `Sources/ode_double_opcode_x64.bat` script (depending on the platform you're building for).
2. Open `Sources/Extras/ode/build/vs2010/ode.sln` Visual Studio solution and compile the project using `ReleaseDLL` build configuration.

After that, when building the mod, it will automatically link the generated `ode.lib` file and copy `ode.dll` into the `Bin/` directory.

# Running

Once the project is compiled, there should be three libraries in the Bin folder: `EntitiesMP.dll`, `GameGUIMP.dll` and `GameMP.dll`.

There are two ways to start the mod:
1. Create a `.des` file in your Mods directory under the same name as this repository, open it in any text editor and type your mod name in it. Then you'll be able to launch your mod from the game's `Mods` list.
2. Run any of the mod launchers from the Bin folder to open the mod (e.g. `SeriousSam.exe`) or the editor (e.g. `SeriousEditor.exe`).

When running a selected project from Visual Studio, make sure that the mod in project properties **Debugging** -> **Command Arguments** is set to your mod name instead of `HL2IM` (example: `+game HL2IM_Mod`).

# License

**Serious Immersion: Half-Life 2** is licensed under the GNU GPL v2 (see LICENSE file).

Some of the code included with the SDK (under `Sources/Extras/`) is not licensed under GNU GPL v2:

- **Open Dynamics Engine** 0.16.5 (`ode/`) from https://www.ode.org/
