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

#ifndef CECIL_ODE_API_H
#define CECIL_ODE_API_H

// Physics object wrapper
struct DECL_DLL SPhysObject {
  class odeObject *pObj;

  SPhysObject();
  ~SPhysObject();

  static class odeObject *ForEntity(CEntity *pen);
};

// Create global physics engine on game start
DECL_DLL void ODE_Init(void);

// Start ODE physics for the current simulation
DECL_DLL void ODE_Start(void);

// Stop ODE physics for the current simulation
DECL_DLL void ODE_End(void);

// Read data that was saved during loading
DECL_DLL void ODE_ReadSavedData(void);

// Check if ODE physics started for the current simulation
DECL_DLL BOOL ODE_IsStarted(void);

// Simulate the ODE world for one tick
DECL_DLL void ODE_DoSimulation(CWorld *pwo);

// Get amount of simulation iterations that happen each game tick
DECL_DLL INDEX ODE_GetSimIterations(void);

// [Cecil] TEMP: Report on collisions with physics objects
void ODE_ReportCollision(const char *strFormat, ...);

__forceinline CTString ODE_PrintVectorForReport(const FLOAT3D &v) {
  return CTString(0, "pos(%+.2f, %+.2f, %+.2f)", v(1), v(2), v(3));
};

__forceinline CTString ODE_PrintPlaneForReport(const FLOATplane3D &pl) {
  return CTString(0, "plane(%+.2f, %+.2f, %+.2f;  %+.2f)", pl(1), pl(2), pl(3), pl.Distance());
};

#endif
