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

#ifndef CECIL_INCL_ODESTATE_H
#define CECIL_INCL_ODESTATE_H

#ifdef PRAGMA_ONCE
  #pragma once
#endif

#include <EntitiesMP/Cecil/WriteStream.h>

#include <XGizmo/Base/STLIncludesBegin.h>
#include <ode/ode/src/objects.h>
#include <ode/ode/src/joints/joints.h>
#include <XGizmo/Base/STLIncludesEnd.h>

extern CPhysEngine *_pODE;

// Helper functions
inline void WriteVector(CTStream *pstrm, const dVector3 v) {
  *pstrm << v[0] << v[1] << v[2];
};

inline void WriteQuat(CTStream *pstrm, const dQuaternion q) {
  *pstrm << q[0] << q[1] << q[2] << q[3];
};

inline void WriteMatrix(CTStream *pstrm, const dMatrix3 m) {
  *pstrm << m[0] << m[1] << m[2] << m[3] << m[4] << m[5] << m[6] << m[7] << m[8] << m[9] << m[10] << m[11];
};

inline void ReadVector(CTStream *pstrm, dVector3 v) {
  *pstrm >> v[0] >> v[1] >> v[2];
};

inline void ReadQuat(CTStream *pstrm, dQuaternion q) {
  *pstrm >> q[0] >> q[1] >> q[2] >> q[3];
};

inline void ReadMatrix(CTStream *pstrm, dMatrix3 m) {
  *pstrm >> m[0] >> m[1] >> m[2] >> m[3] >> m[4] >> m[5] >> m[6] >> m[7] >> m[8] >> m[9] >> m[10] >> m[11];
};

// Data chunks
static const CChunkID _cidODE_World     ("ODEW"); // World state
static const CChunkID _cidODE_Simulation("SIML"); // Simulation properties

static const CChunkID _cidODE_Objects   ("ODEO"); // Object list
static const CChunkID _cidODE_ObjProps  ("OBJP"); // Object properties
static const CChunkID _cidODE_ObjGeom   ("OBJG"); // Object geom
static const CChunkID _cidODE_ObjJoint  ("OBJJ"); // Object joint

static const CChunkID _cidODE_ObjBody   ("OBJB"); // Object body

static const CChunkID _cidODE_Joints    ("ODEJ"); // Joint list
static const CChunkID _cidODE_OneJoint  ("JOIN"); // One joint

#endif
