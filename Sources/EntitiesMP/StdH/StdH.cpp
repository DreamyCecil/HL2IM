/* Copyright (c) 2024 Dreamy Cecil
This program is free software; you can redistribute it and/or modify
it under the terms of version 2 of the GNU General Public License as published by
the Free Software Foundation


This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

#include "StdH.h"

#include <XGizmo/Interfaces/Directories.h>

// Library entry point
BOOL APIENTRY DllMain(HANDLE hModule, DWORD ulReason, LPVOID lpReserved) {
  // Reason for calling the module
  switch (ulReason)
  {
    // Library initialization
    case DLL_PROCESS_ATTACH:
      // Delayed loading of ODE library from the mod directory
      LoadLibraryA(IDir::AppPath() + _fnmMod + IDir::AppModBin() + "ode.dll");
      break;

    // Library cleanup
    case DLL_PROCESS_DETACH:
      break;
  }

  return TRUE;
};
