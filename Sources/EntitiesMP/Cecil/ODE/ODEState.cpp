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

// [Cecil] NOTE: If ODE version is updated, make sure to check the diff from the last used version for new code!

#include "StdH.h"

#include "ODEState.h"

// Write world data
void CPhysEngine::WriteWorld(CWriteStream &strm) {
  // Main world data
  strm.WriteVector_key(world->gravity);

  strm.Write_key(world->global_erp);
  strm.Write_key(world->global_cfm);

  // Auto-disable
  strm.Write_key(world->adis.linear_average_threshold);
  strm.Write_key(world->adis.angular_average_threshold);
  strm.Write("world->adis.average_samples", (ULONG)world->adis.average_samples);
  strm.Write_key(world->adis.idle_time);
  strm.Write_key(world->adis.idle_steps);

  strm.Write_key(world->qs.num_iterations);
  strm.Write_key(world->qs.w);
  strm.Write_key(world->contactp.max_vel);
  strm.Write_key(world->contactp.min_depth);
  strm.Write_key(world->dampingp.linear_scale);
  strm.Write_key(world->dampingp.angular_scale);
  strm.Write_key(world->dampingp.linear_threshold);
  strm.Write_key(world->dampingp.angular_threshold);
  strm.Write_key(world->max_angular_speed);
};

// Read world data
void CPhysEngine::ReadWorld(CTStream *istr) {
  // Main world data
  ReadVector(istr, world->gravity);

  *istr >> world->global_erp;
  *istr >> world->global_cfm;

  // Auto-disable
  *istr >> world->adis.linear_average_threshold;
  *istr >> world->adis.angular_average_threshold;

  ULONG ctSamples;
  *istr >> ctSamples;
  world->adis.average_samples = ctSamples;

  *istr >> world->adis.idle_time;
  *istr >> world->adis.idle_steps;

  *istr >> world->qs.num_iterations;
  *istr >> world->qs.w;
  *istr >> world->contactp.max_vel;
  *istr >> world->contactp.min_depth;
  *istr >> world->dampingp.linear_scale;
  *istr >> world->dampingp.angular_scale;
  *istr >> world->dampingp.linear_threshold;
  *istr >> world->dampingp.angular_threshold;
  *istr >> world->max_angular_speed;
};

// Write current simulation state
void CPhysEngine::WriteState_t(CTStream *postr, BOOL bText) {
  CWriteStream strm(postr, bText);
  const SLONG slDataStart = postr->GetPos_t();

  // ODE world
  strm.WriteID(_cidODE_World);

  // Size of ODE data (filled later)
  const SLONG slODESizePos = postr->GetPos_t();
  strm.Write_key((SLONG)0);

  // 0. Simulation data
  strm.WriteID(_cidODE_Simulation);

  UBYTE ubStarted = !!bStarted;
  strm.Write_key(ubStarted);

  if (!bStarted) return;

  ULONG ulRandomSeed = dRandGetSeed();
  strm.Write_key(ulRandomSeed);

  // 1. World
  WriteWorld(strm);

  // 2. Objects
  CObjects cAll, cWithJoints;
  WriteObjects(strm, cAll, cWithJoints);

  // 3. Joints
  WriteJoints(strm, cWithJoints);

  // 4. Object bodies
  WriteBodies(strm, cAll);

  // Write size of ODE data
  if (!bText) {
    const SLONG slDataEnd = postr->GetPos_t();
    postr->SetPos_t(slODESizePos);

    *postr << SLONG(slDataEnd - slDataStart);
    postr->SetPos_t(slDataEnd);
  }

  ASSERT(ulRandomSeed == dRandGetSeed());
};

// Read simulation state and and reconstruct it from scratch
void CPhysEngine::ReadState_t(CTStream *istr) {
  // ODE world
  istr->ExpectID_t(_cidODE_World);
  CPrintF("^cff9f00Reading ODE world\n");

  // Size of ODE data
  SLONG slODESize;
  *istr >> slODESize;

  // 0. Simulation data
  istr->ExpectID_t(_cidODE_Simulation);

  UBYTE ubStarted;
  *istr >> ubStarted;
  bStarted = ubStarted;

  if (!bStarted) return;

  ULONG ulRandomSeed;
  *istr >> ulRandomSeed;
  dRandSetSeed(ulRandomSeed);

  // 1. World
  ReadWorld(istr);

  // 2. Objects
  CObjects cAll, cWithJoints;
  ReadObjects(istr, cAll, cWithJoints);

  // 3. Joints
  dJointGroupEmpty(jgContacts); // [Cecil] TEMP
  ReadJoints(istr, cWithJoints);

  // 4. Object bodies
  ReadBodies(istr, cAll);

  // [Cecil] TEMP: Clean freshly read geoms
  //dSpaceClean(space);

  ASSERT(ulRandomSeed == dRandGetSeed());
};

// Pre-read save data
void CPhysEngine::ReadSaveData(CTStream *istr) {
  const SLONG slDataStart = istr->GetPos_t();

  istr->ExpectID_t(_cidODE_World);

  // Size of ODE data
  *istr >> slSaveDataSize;

  if (pubSaveData != NULL) delete[] pubSaveData;
  pubSaveData = new UBYTE[slSaveDataSize];

  istr->SetPos_t(slDataStart);
  istr->Read_t(pubSaveData, slSaveDataSize);
};
