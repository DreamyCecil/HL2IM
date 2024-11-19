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

#ifndef CECIL_ODE_BASE_H
#define CECIL_ODE_BASE_H

// __declspec(deprecated) isn't a thing in MSVC 6.0
#if _MSC_VER < 1600
  #define deprecated
#endif

#include <ode/ode.h>

#include <ode/odecpp.h>
#include <ode/odecpp_collision.h>

#include "ODEObject.h"

// Global physics engine
class CPhysEngine {
  public:
    BOOL bStarted; // Whether the physics simulation has started

    dWorldID world; // World the objects belong to
    dSpaceID space; // World's collision space
    dJointGroupID jgContacts; // Group of temporary contact joints

    CDynamicContainer<odeObject> cWorldMeshes; // Static world geometry

    CListHead lhObjects; // All odeObject instances in the world

    // Pre-read save data
    UBYTE *pubSaveData;
    SLONG slSaveDataSize;

  public:
    // Constructor
    CPhysEngine(void);

    // Add a new world mesh
    odeObject *AddWorldMesh(void);

    // Clear all world meshes
    void ClearWorldMeshes(void);

    // Check if some object is one of the world meshes
    inline BOOL IsWorldMesh(const odeObject *pObj) {
      return !!(pObj->ulSetupFlags & OBJF_WORLD);
    };

  private:
    typedef CDynamicContainer<odeObject> CObjects;

    // Write object data
    void WriteObjects(class CWriteStream &strm, CObjects &cAll, CObjects &cWithJoints);

    // Read object data
    void ReadObjects(CTStream *istr, CObjects &cAll, CObjects &cWithJoints);

    // Write joint data
    void WriteJoints(class CWriteStream &strm, CObjects &cWithJoints);

    // Read joint data
    void ReadJoints(CTStream *istr, CObjects &cWithJoints);

    // Write object body data
    void WriteBodies(class CWriteStream &strm, CObjects &cAll);

    // Read object body data
    void ReadBodies(CTStream *istr, CObjects &cAll);

    // Write world data
    void WriteWorld(class CWriteStream &strm);

    // Read world data
    void ReadWorld(CTStream *istr);

  public:
    // Write current simulation state
    void WriteState_t(CTStream *ostr, BOOL bText);

    // Read simulation state and and reconstruct it from scratch
    void ReadState_t(CTStream *istr);

    // Pre-read save data
    void ReadSaveData(CTStream *istr);
};

#endif
